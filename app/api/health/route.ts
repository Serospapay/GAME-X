import { ok, fail } from "@/lib/api-response";
import { connectDB } from "@/lib/mongodb";

export async function GET() {
  const envChecks = {
    mongodb: Boolean(process.env.MONGODB_URI),
    authSecret: Boolean(process.env.AUTH_SECRET),
    cronSecret: Boolean(process.env.CRON_SECRET),
  };

  try {
    const conn = await connectDB();
    const dbState = conn.connection.readyState;

    return ok({
      status: "ok",
      timestamp: new Date().toISOString(),
      dbState,
      env: envChecks,
    });
  } catch (error) {
    console.error("GET /api/health:", error);
    return fail("Health check failed", 500, "HEALTH_FAIL");
  }
}
