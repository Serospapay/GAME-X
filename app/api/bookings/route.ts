import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { fail, ok } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit-log";
import { connectDB } from "@/lib/mongodb";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { Computer } from "@/models/Computer";
import { Booking } from "@/models/Booking";

const MIN_HOURS = 1;
const MAX_HOURS = 12;

const BookingBodySchema = z.object({
  computerId: z.string().min(1),
  hours: z.coerce.number().int().min(MIN_HOURS).max(MAX_HOURS),
  clientName: z.string().trim().max(100).optional(),
});
const MIN_IDEMPOTENCY_KEY_LENGTH = 8;
const MAX_IDEMPOTENCY_KEY_LENGTH = 120;

function isTransactionNotSupported(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Transaction numbers are only allowed") ||
    error.message.includes("replica set member")
  );
}

export async function POST(request: NextRequest) {
  const ipKey = getIpKey(request);
  const session = await getServerSession(authOptions);
  const role = session?.user ? "user" : "guest";
  const identityKey = session?.user?.email ?? ipKey;
  const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim();
  const idempotencyKey = rawIdempotencyKey
    ? `${ipKey}:${rawIdempotencyKey}`
    : undefined;
  const rate = checkRoleRateLimit(
    "bookings",
    role,
    identityKey,
    getPolicy(RATE_LIMIT_POLICIES.bookingCreate, role)
  );
  if (!rate.allowed) {
    return fail(
      `Занадто багато запитів. Повторіть через ${rate.retryAfterSec} с.`,
      429,
      "RATE_LIMITED"
    );
  }

  try {
    const rawBody = await request.json().catch(() => null);
    const parsedBody = BookingBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return fail("Невірні вхідні дані для бронювання", 400, "VALIDATION_ERROR");
    }

    const { computerId, hours, clientName } = parsedBody.data;
    if (
      rawIdempotencyKey &&
      (rawIdempotencyKey.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
        rawIdempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH)
    ) {
      return fail(
        `Idempotency-Key має бути від ${MIN_IDEMPOTENCY_KEY_LENGTH} до ${MAX_IDEMPOTENCY_KEY_LENGTH} символів`,
        400,
        "INVALID_IDEMPOTENCY_KEY"
      );
    }

    if (!mongoose.Types.ObjectId.isValid(computerId)) {
      return fail("Невірний ідентифікатор комп'ютера", 400, "INVALID_COMPUTER_ID");
    }

    const name =
      session?.user?.name ?? clientName?.trim() ?? "Гість";
    const clientId = session?.user?.id && mongoose.Types.ObjectId.isValid(session.user.id)
      ? new mongoose.Types.ObjectId(session.user.id)
        : undefined;
    const clientEmail = session?.user?.email ?? undefined;

    await connectDB();

    if (idempotencyKey) {
      const existing = await Booking.findOne({ idempotencyKey }).lean();
      if (existing) {
        return ok({
          success: true,
          idempotentReplay: true,
          bookingId: existing._id.toString(),
          startTime: existing.startTime.toISOString(),
          endTime: existing.endTime.toISOString(),
          totalAmount: existing.totalAmount,
        });
      }
    }

    const computerObjectId = new mongoose.Types.ObjectId(computerId);
    const now = new Date();
    const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const createBookingFlow = async (sessionTx?: mongoose.ClientSession) => {
      const computer = await Computer.findOneAndUpdate(
        { _id: computerObjectId, status: "вільний" },
        { status: "зайнятий" },
        { new: true, session: sessionTx }
      ).lean();

      if (!computer) {
        const exists = await Computer.findById(computerObjectId)
          .session(sessionTx ?? null)
          .lean();
        if (!exists) {
          return fail("Комп'ютер не знайдено", 404, "NOT_FOUND");
        }
        return fail(
          "Місце вже зайняте або недоступне для бронювання",
          409,
          "BOOKING_CONFLICT"
        );
      }

      const totalAmount = computer.pricePerHour * hours;
      const created = await Booking.create(
        [
          {
            computer: computerObjectId,
            clientName: name,
            clientId,
            clientEmail,
            startTime: now,
            endTime,
            totalAmount,
            idempotencyKey,
          },
        ],
        sessionTx ? { session: sessionTx } : undefined
      );

      const booking = created[0];
      await writeAuditLog({
        actorEmail: clientEmail ?? undefined,
        actorRole: session?.user ? "user" : "system",
        action: "booking.create",
        targetType: "booking",
        targetId: booking._id.toString(),
        metadata: {
          computerId: computerObjectId.toString(),
          hours,
          totalAmount,
        },
      });
      return ok(
        {
          success: true,
          bookingId: booking._id.toString(),
          startTime: now.toISOString(),
          endTime: endTime.toISOString(),
          totalAmount,
        },
        200
      );
    };

    const tx = await mongoose.startSession();
    try {
      let response: NextResponse | null = null;
      await tx.withTransaction(async () => {
        response = await createBookingFlow(tx);
      });
      await tx.endSession();
      return response ?? fail("Помилка транзакції", 500, "TX_UNKNOWN");
    } catch (txError) {
      await tx.endSession();
      if (
        txError &&
        typeof txError === "object" &&
        "code" in txError &&
        txError.code === 11000 &&
        idempotencyKey
      ) {
        const existing = await Booking.findOne({ idempotencyKey }).lean();
        if (existing) {
          return ok({
            success: true,
            idempotentReplay: true,
            bookingId: existing._id.toString(),
            startTime: existing.startTime.toISOString(),
            endTime: existing.endTime.toISOString(),
            totalAmount: existing.totalAmount,
          });
        }
      }
      if (isTransactionNotSupported(txError)) {
        return createBookingFlow();
      }
      throw txError;
    }

  } catch (error) {
    console.error("POST /api/bookings:", error);
    return fail(
      "Помилка при створенні бронювання",
      500,
      "BOOKING_INTERNAL_ERROR"
    );
  }
}
