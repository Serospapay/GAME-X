import type { RateLimitOptions, RateLimitRole } from "@/lib/rate-limit";

type RolePolicy = Partial<Record<RateLimitRole, RateLimitOptions>>;

export const RATE_LIMIT_POLICIES = {
  auth: {
    guest: { limit: 12, windowMs: 60_000 },
  },
  bookingCreate: {
    guest: { limit: 20, windowMs: 60_000 },
    user: { limit: 60, windowMs: 60_000 },
  },
  personalization: {
    user: { limit: 120, windowMs: 60_000 },
  },
  adminReleaseComputer: {
    admin: { limit: 45, windowMs: 60_000 },
  },
  adminAuditLogs: {
    admin: { limit: 60, windowMs: 60_000 },
  },
  cronRelease: {
    system: { limit: 10, windowMs: 60_000 },
  },
  cronCleanupIdempotency: {
    system: { limit: 6, windowMs: 60_000 },
  },
  cronArchiveAudit: {
    system: { limit: 6, windowMs: 60_000 },
  },
  seed: {
    system: { limit: 5, windowMs: 60_000 },
  },
} satisfies Record<string, RolePolicy>;

export function getPolicy(
  policy: RolePolicy,
  role: RateLimitRole
): RateLimitOptions {
  return (
    policy[role] ??
    policy.guest ?? {
      limit: 30,
      windowMs: 60_000,
    }
  );
}
