const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function assertStatus(path, expectedStatuses, init) {
  const res = await fetch(`${baseUrl}${path}`, init);
  if (!expectedStatuses.includes(res.status)) {
    const body = await res.text();
    throw new Error(
      `[${path}] expected ${expectedStatuses.join("|")}, got ${res.status}: ${body}`
    );
  }
  return res;
}

async function run() {
  await assertStatus("/api/health", [200]);
  await assertStatus("/api/computers", [200]);
  await assertStatus(
    "/api/bookings",
    [400, 401],
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ computerId: "bad-id", hours: 0 }),
    }
  );

  console.log(`Smoke OK for ${baseUrl}`);
}

run().catch((error) => {
  console.error("Smoke FAILED:", error);
  process.exit(1);
});
