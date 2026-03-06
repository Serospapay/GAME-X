import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getPolicy, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";
import { checkRoleRateLimit, getIpKey } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";
import { buildSeedComputers } from "@/lib/seed-computers";

export async function GET(request: NextRequest) {
  const ipKey = getIpKey(request);
  const rate = checkRoleRateLimit(
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
