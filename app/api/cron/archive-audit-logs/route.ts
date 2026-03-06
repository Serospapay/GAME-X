import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { writeAuditLog } from "@/lib/audit-log";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";
import { AuditLog } from "@/models/AuditLog";
import { AuditLogArchive } from "@/models/AuditLogArchive";

const CRON_SECRET = process.env.CRON_SECRET;
const MAIN_RETENTION_DAYS = 7;
const ARCHIVE_RETENTION_DAYS = 180;
const DEFAULT_BATCH_LIMIT = 500;

export async function GET(request: NextRequest) {
  const ipKey = getIpKey(request);
  const rate = checkRoleRateLimit(
    "cron-audit-archive",
    "system",
    ipKey,
    getPolicy(RATE_LIMIT_POLICIES.cronArchiveAudit, "system")
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
    const url = new URL(request.url);
    const limitRaw = url.searchParams.get("limit");
    const parsed = limitRaw ? Number.parseInt(limitRaw, 10) : DEFAULT_BATCH_LIMIT;
    const batchLimit =
      Number.isFinite(parsed) && parsed > 0 && parsed <= 2000
        ? parsed
        : DEFAULT_BATCH_LIMIT;

    const cutoff = new Date(Date.now() - MAIN_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const toArchive = await AuditLog.find({
      createdAt: { $lt: cutoff },
    })
      .sort({ createdAt: 1 })
      .limit(batchLimit)
      .lean();

    if (toArchive.length === 0) {
      return ok({
        success: true,
        archived: 0,
        deleted: 0,
        message: "Немає старих audit logs для архівації",
      });
    }

    const archiveExpiresAt = new Date(
      Date.now() + ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const archiveDocs = toArchive.map((log) => ({
      sourceLogId: log._id.toString(),
      actorEmail: log.actorEmail,
      actorRole: log.actorRole,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata:
        (log.metadata as Record<string, string | number | boolean | null> | undefined) ??
        undefined,
      sourceCreatedAt: log.createdAt,
      expiresAt: archiveExpiresAt,
    }));

    await AuditLogArchive.insertMany(archiveDocs, { ordered: false }).catch(
      async (error: unknown) => {
        if (
          !(error instanceof Error) ||
          !error.message.toLowerCase().includes("duplicate key")
        ) {
          throw error;
        }
      }
    );

    const sourceIds = toArchive.map((log) => log._id);
    const deleted = await AuditLog.deleteMany({ _id: { $in: sourceIds } });

    await writeAuditLog({
      actorRole: "system",
      action: "cron.audit.archive.success",
      targetType: "audit-log",
      metadata: {
        archivedCount: toArchive.length,
        deletedCount: deleted.deletedCount,
      },
    });

    return ok({
      success: true,
      archived: toArchive.length,
      deleted: deleted.deletedCount,
      mainRetentionDays: MAIN_RETENTION_DAYS,
      archiveRetentionDays: ARCHIVE_RETENTION_DAYS,
    });
  } catch (error) {
    await writeAuditLog({
      actorRole: "system",
      action: "cron.audit.archive.error",
      targetType: "audit-log",
      metadata: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    });
    console.error("GET /api/cron/archive-audit-logs:", error);
    return fail("Помилка архівації audit logs", 500, "CRON_ARCHIVE_AUDIT_FAILED");
  }
}
