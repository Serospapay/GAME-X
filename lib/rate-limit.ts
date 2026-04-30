import { connectDB } from "@/lib/mongodb";
import { RateLimitWindow } from "@/models/RateLimitWindow";

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

const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_REGEX = /^([0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}$/i;

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const withCode = error as { code?: unknown };
  return withCode.code === 11000;
}

function isValidIp(value: string): boolean {
  return IPV4_REGEX.test(value) || IPV6_REGEX.test(value);
}

function sanitizeIp(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  return isValidIp(normalized) ? normalized : null;
}

export function getIpKey(request: Request): string {
  const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  if (trustProxyHeaders) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const first = forwardedFor.split(",")[0];
      const candidate = first ? sanitizeIp(first) : null;
      if (candidate) return candidate;
    }
    const trustedHeaders = [
      request.headers.get("x-real-ip"),
      request.headers.get("cf-connecting-ip"),
      request.headers.get("x-vercel-forwarded-for"),
    ];
    for (const headerValue of trustedHeaders) {
      if (!headerValue) continue;
      const candidate = sanitizeIp(headerValue);
      if (candidate) return candidate;
    }
  }

  return "ip-unavailable";
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const now = Date.now();
  const nowDate = new Date(now);
  const resetAt = new Date(now + options.windowMs);
  await connectDB();

  const incremented = await RateLimitWindow.findOneAndUpdate(
    { key, resetAt: { $gt: nowDate } },
    { $inc: { count: 1 } },
    { new: true }
  ).lean();

  if (incremented) {
    if (incremented.count > options.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil((incremented.resetAt.getTime() - now) / 1000),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(options.limit - incremented.count, 0),
      retryAfterSec: Math.ceil((incremented.resetAt.getTime() - now) / 1000),
    };
  }

  try {
    await RateLimitWindow.create({
      key,
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: options.limit - 1,
      retryAfterSec: Math.ceil(options.windowMs / 1000),
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }
  }

  const retried = await RateLimitWindow.findOneAndUpdate(
    { key, resetAt: { $gt: nowDate } },
    { $inc: { count: 1 } },
    { new: true }
  ).lean();

  if (retried) {
    if (retried.count > options.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.ceil((retried.resetAt.getTime() - now) / 1000),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(options.limit - retried.count, 0),
      retryAfterSec: Math.ceil((retried.resetAt.getTime() - now) / 1000),
    };
  }

  const resetWindow = await RateLimitWindow.findOneAndUpdate(
    { key },
    { $set: { count: 1, resetAt } },
    { new: true, upsert: true }
  ).lean();

  if (!resetWindow) {
    return {
      allowed: true,
      remaining: options.limit - 1,
      retryAfterSec: Math.ceil(options.windowMs / 1000),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(options.limit - resetWindow.count, 0),
    retryAfterSec: Math.ceil((resetWindow.resetAt.getTime() - now) / 1000),
  };
}

export async function checkRoleRateLimit(
  namespace: string,
  role: RateLimitRole,
  identityKey: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  return checkRateLimit(`${namespace}:${role}:${identityKey}`, options);
}
