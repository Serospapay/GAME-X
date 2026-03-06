import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guard";
import { fail, ok } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit-log";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";
import { Booking } from "@/models/Booking";

const ParamsSchema = z.object({
  id: z.string().min(1),
});

function isTransactionNotSupported(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Transaction numbers are only allowed") ||
    error.message.includes("replica set member")
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminAuth = await requireAdmin();
    if (adminAuth.response) return adminAuth.response;
    const actorEmail = adminAuth.session?.user?.email ?? undefined;
    const adminIdentity = actorEmail ?? getIpKey(request);
    const rate = checkRoleRateLimit(
      "admin-release",
      "admin",
      adminIdentity,
      getPolicy(RATE_LIMIT_POLICIES.adminReleaseComputer, "admin")
    );
    if (!rate.allowed) {
      return fail(
        `Забагато адмін-запитів. Повторіть через ${rate.retryAfterSec} с.`,
        429,
        "RATE_LIMITED"
      );
    }
    const parsedParams = ParamsSchema.safeParse(await params);

    if (!parsedParams.success) {
      return fail("Невірні параметри запиту", 400, "VALIDATION_ERROR");
    }
    const { id } = parsedParams.data;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return fail("Невірний ідентифікатор комп'ютера", 400, "INVALID_COMPUTER_ID");
    }

    const computerObjectId = new mongoose.Types.ObjectId(id);
    await connectDB();

    const releaseFlow = async (sessionTx?: mongoose.ClientSession) => {
      const computer = await Computer.findById(computerObjectId)
        .session(sessionTx ?? null)
        .lean();
      if (!computer) {
        return fail("Комп'ютер не знайдено", 404, "NOT_FOUND");
      }

      await Computer.updateOne(
        { _id: computerObjectId },
        { status: "вільний" },
        sessionTx ? { session: sessionTx } : undefined
      );

      await Booking.updateMany(
        { computer: computerObjectId, isCompleted: { $ne: true } },
        { isCompleted: true },
        sessionTx ? { session: sessionTx } : undefined
      );

      await writeAuditLog({
        actorEmail,
        actorRole: "admin",
        action: "admin.computer.release",
        targetType: "computer",
        targetId: computerObjectId.toString(),
        metadata: {
          byPath: request.nextUrl.pathname,
        },
      });

      return ok({
        success: true,
        message: "Сесію завершено, ПК звільнено",
      });
    };

    const tx = await mongoose.startSession();
    try {
      let response: NextResponse | null = null;
      await tx.withTransaction(async () => {
        response = await releaseFlow(tx);
      });
      await tx.endSession();
      return response ?? fail("Помилка транзакції", 500, "TX_UNKNOWN");
    } catch (txError) {
      await tx.endSession();
      if (isTransactionNotSupported(txError)) {
        return releaseFlow();
      }
      throw txError;
    }
  } catch (error) {
    await writeAuditLog({
      actorRole: "admin",
      action: "admin.computer.release.error",
      targetType: "computer",
      metadata: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    console.error("PATCH /api/admin/computers/[id]:", error);
    return fail("Помилка при завершенні сесії", 500, "ADMIN_RELEASE_FAILED");
  }
}
