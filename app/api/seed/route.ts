import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/auth-guard";
import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";
import { buildSeedComputers } from "@/lib/seed-computers";

const SEED_SECRET = process.env.SEED_SECRET;

async function hasSeedAccess(request: NextRequest): Promise<boolean> {
  const adminAuth = await requireAdmin();
  if (!adminAuth.response) return true;

  const authHeader = request.headers.get("authorization");
  const bearerToken =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const secretHeader = request.headers.get("x-seed-secret");

  if (!SEED_SECRET) return false;
  return bearerToken === SEED_SECRET || secretHeader === SEED_SECRET;
}

export async function POST(request: NextRequest) {
  const ipKey = getIpKey(request);
  const rate = await checkRoleRateLimit(
    "seed",
    "system",
    ipKey,
    getPolicy(RATE_LIMIT_POLICIES.seed, "system")
  );
  if (!rate.allowed) {
    return fail(
      `Забагато запитів на seed. Повторіть через ${rate.retryAfterSec} с.`,
      429,
      "RATE_LIMITED"
    );
  }

  if (process.env.NODE_ENV === "production") {
    return fail("Seeding дозволено лише в режимі розробки", 403, "FORBIDDEN");
  }

  const allowed = await hasSeedAccess(request);
  if (!allowed) {
    return fail("Недостатньо прав для seed-операції", 403, "FORBIDDEN");
  }

  try {
    await connectDB();
    await Computer.deleteMany({});
    const data = buildSeedComputers();
    const result = await Computer.insertMany(data);
    return ok({
      success: true,
      message: "Базу даних успішно наповнено",
      count: result.length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return fail("Помилка під час наповнення бази", 500, "SEED_FAILED");
  }
}

export async function GET() {
  return fail("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
}
