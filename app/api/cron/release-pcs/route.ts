import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { fail, ok } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit-log";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";
import { Booking } from "@/models/Booking";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  const ipKey = getIpKey(request);
  const rate = await checkRoleRateLimit(
    "cron-release",
    "system",
    ipKey,
    getPolicy(RATE_LIMIT_POLICIES.cronRelease, "system")
  );
  if (!rate.allowed) {
    return fail(
      `Too many cron requests. Retry after ${rate.retryAfterSec}s.`,
      429,
      "RATE_LIMITED"
    );
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return fail("Unauthorized", 401, "UNAUTHORIZED");
  }

  try {
    await connectDB();

    const now = new Date();
    const expiredBookings = await Booking.find({
      endTime: { $lt: now },
      isCompleted: { $ne: true },
    }).lean();

    const computerIds = [
      ...new Set(expiredBookings.map((b) => b.computer.toString())),
    ];

    if (computerIds.length === 0) {
      return ok({ released: 0, message: "Немає сесій для завершення" });
    }

    const objectIds = computerIds.map((id) => new mongoose.Types.ObjectId(id));

    const tx = await mongoose.startSession();
    try {
      await tx.withTransaction(async () => {
        await Computer.updateMany(
          { _id: { $in: objectIds } },
          { status: "вільний" },
          { session: tx }
        );

        await Booking.updateMany(
          { _id: { $in: expiredBookings.map((b) => b._id) } },
          { isCompleted: true },
          { session: tx }
        );
      });
      await tx.endSession();
    } catch (txError) {
      await tx.endSession();
      const message = txError instanceof Error ? txError.message : "";
      if (
        !message.includes("Transaction numbers are only allowed") &&
        !message.includes("replica set member")
      ) {
        throw txError;
      }

      await Computer.updateMany({ _id: { $in: objectIds } }, { status: "вільний" });
      await Booking.updateMany(
        { _id: { $in: expiredBookings.map((b) => b._id) } },
        { isCompleted: true }
      );
    }

    await writeAuditLog({
      actorRole: "system",
      action: "cron.release.success",
      targetType: "computer",
      metadata: {
        released: computerIds.length,
      },
    });

    return ok({
      success: true,
      released: computerIds.length,
      message: `Звільнено ${computerIds.length} ПК`,
    });
  } catch (error) {
    await writeAuditLog({
      actorRole: "system",
      action: "cron.release.error",
      targetType: "computer",
      metadata: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    console.error("POST /api/cron/release-pcs:", error);
    return fail("Помилка при автоматичному звільненні ПК", 500, "CRON_RELEASE_FAILED");
  }
}

export async function GET() {
  return fail("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
}
