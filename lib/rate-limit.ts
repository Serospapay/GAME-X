interface WindowState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowState>();
let callsSinceCleanup = 0;

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export type RateLimitRole = "guest" | "user" | "admin" | "system";

export function getIpKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  return realIp ?? "unknown";
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  callsSinceCleanup += 1;
  if (callsSinceCleanup >= 500) {
    callsSinceCleanup = 0;
    for (const [bucketKey, state] of buckets.entries()) {
      if (state.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      allowed: true,
      remaining: options.limit - 1,
      retryAfterSec: Math.ceil(options.windowMs / 1000),
    };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return {
    allowed: true,
    remaining: options.limit - existing.count,
    retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
  };
}

export function checkRoleRateLimit(
  namespace: string,
  role: RateLimitRole,
  identityKey: string,
  options: RateLimitOptions
): RateLimitResult {
  return checkRateLimit(`${namespace}:${role}:${identityKey}`, options);
}
