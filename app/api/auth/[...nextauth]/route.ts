import NextAuth from "next-auth";
import { authOptions } from "@/auth";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { fail } from "@/lib/api-response";

const handler = NextAuth(authOptions);

export const GET = handler;

export async function POST(
  request: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params;
  const authAction = params.nextauth?.[0];
  const isSensitiveAuthAction = authAction === "callback" || authAction === "signin";
  if (!isSensitiveAuthAction) {
    return handler(request, context);
  }

  const ipKey = getIpKey(request);
  const rate = await checkRoleRateLimit(
    "auth",
    "guest",
    ipKey,
    getPolicy(RATE_LIMIT_POLICIES.auth, "guest")
  );
  if (!rate.allowed) {
    return fail(
      `Забагато спроб авторизації. Повторіть через ${rate.retryAfterSec} с.`,
      429,
      "AUTH_RATE_LIMITED"
    );
  }

  return handler(request, context);
}
