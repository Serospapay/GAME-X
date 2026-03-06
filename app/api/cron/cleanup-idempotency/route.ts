import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit-log";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";

const CRON_SECRET = process.env.CRON_SECRET;
const IDEMPOTENCY_RETENTION_HOURS = 24;

export async function GET(request: NextRequest) {
  const ipKey = getIpKey(request);
  const rate = checkRoleRateLimit(
    "cron-idempotency-cleanup",
    "system",
    ipKey,
    getPolicy(RATE_LIMIT_POLICIES.cronCleanupIdempotency, "system")
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
    const cutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_HOURS * 60 * 60 * 1000);
    const result = await Booking.updateMany(
      {
        idempotencyKey: { $exists: true, $ne: null },
        createdAt: { $lt: cutoff },
      },
      {
        $unset: { idempotencyKey: "" },
      }
    );

    await writeAuditLog({
      actorRole: "system",
      action: "cron.idempotency.cleanup.success",
      targetType: "booking",
      metadata: {
        modifiedCount: result.modifiedCount,
      },
    });

    return ok({
      success: true,
      cleaned: result.modifiedCount,
      retentionHours: IDEMPOTENCY_RETENTION_HOURS,
    });
  } catch (error) {
    await writeAuditLog({
      actorRole: "system",
      action: "cron.idempotency.cleanup.error",
      targetType: "booking",
      metadata: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    console.error("GET /api/cron/cleanup-idempotency:", error);
    return fail(
      "Помилка cleanup idempotency-ключів",
      500,
      "CRON_IDEMPOTENCY_CLEANUP_FAILED"
    );
  }
}
