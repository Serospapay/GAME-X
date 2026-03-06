import { connectDB } from "@/lib/mongodb";
import { AuditLog } from "@/models/AuditLog";

export interface AuditPayload {
  actorEmail?: string;
  actorRole: "system" | "admin" | "user";
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function writeAuditLog(payload: AuditPayload): Promise<void> {
  try {
    await connectDB();
    const retentionDaysRaw = process.env.AUDIT_LOG_RETENTION_DAYS;
    const retentionDaysParsed = retentionDaysRaw
      ? Number.parseInt(retentionDaysRaw, 10)
      : Number.NaN;
    const retentionDays =
      Number.isFinite(retentionDaysParsed) && retentionDaysParsed > 0
        ? retentionDaysParsed
        : 30;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    await AuditLog.create({
      ...payload,
      expiresAt,
    });
  } catch (error) {
    console.error("AUDIT_LOG_WRITE_FAILED:", error);
  }
}
