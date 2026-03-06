import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guard";
import { fail, ok } from "@/lib/api-response";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";
import { AuditLog } from "@/models/AuditLog";
import { AuditLogArchive } from "@/models/AuditLogArchive";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  source: z.enum(["main", "archive"]).default("main"),
});

interface AuditLogItem {
  id: string;
  actorEmail: string | null;
  actorRole: "system" | "admin" | "user";
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
  createdAt: string | null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const adminIdentity = auth.session.user.email ?? getIpKey(request);
  const rate = checkRoleRateLimit(
    "admin-audit",
    "admin",
    adminIdentity,
    getPolicy(RATE_LIMIT_POLICIES.adminAuditLogs, "admin")
  );
  if (!rate.allowed) {
    return fail(
      `Забагато запитів до audit log. Повторіть через ${rate.retryAfterSec} с.`,
      429,
      "RATE_LIMITED"
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
  });
  if (!parsed.success) {
    return fail("Невірні query параметри", 400, "VALIDATION_ERROR");
  }

  try {
    await connectDB();
    const source = parsed.data.source;
    const docs = await (source === "archive" ? AuditLogArchive.find({}) : AuditLog.find({}))
      .sort({ createdAt: -1 })
      .limit(parsed.data.limit)
      .lean();

    const items: AuditLogItem[] = docs.map((doc) => ({
      id: doc._id.toString(),
      actorEmail: doc.actorEmail ?? null,
      actorRole: doc.actorRole,
      action: doc.action,
      targetType: doc.targetType,
      targetId: doc.targetId ?? null,
      metadata:
        (doc.metadata as Record<string, string | number | boolean | null> | undefined) ??
        null,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    }));

    return ok({
      success: true,
      source,
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("GET /api/admin/audit-logs:", error);
    return fail("Не вдалося завантажити audit logs", 500, "AUDIT_LOG_FETCH_FAILED");
  }
}
