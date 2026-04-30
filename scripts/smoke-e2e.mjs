const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function expectStatus(path, statuses, init) {
  const res = await fetch(`${baseUrl}${path}`, init);
  if (!statuses.includes(res.status)) {
    const body = await res.text();
    throw new Error(
      `[${path}] expected ${statuses.join("|")}, got ${res.status}: ${body}`
    );
  }
  return res;
}

async function run() {
  await expectStatus("/api/health", [200]);
  await expectStatus("/api/computers", [200]);
  await expectStatus("/api/auth/csrf", [200]);
  await expectStatus("/api/admin/computers/invalid-id", [401, 403, 400], {
    method: "PATCH",
  });
  await expectStatus("/api/admin/audit-logs", [401, 403], {
    method: "GET",
  });
  await expectStatus("/api/cron/release-pcs", [401], {
    method: "POST",
  });
  await expectStatus("/api/cron/cleanup-idempotency", [401], {
    method: "POST",
  });
  await expectStatus("/api/cron/archive-audit-logs", [401], {
    method: "POST",
  });

  // Перевірка idempotency/валідації на публічному сценарії без дублювань.
  const idemKey = `smoke-${Date.now()}-key`;
  await expectStatus("/api/bookings", [400], {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idemKey,
    },
    body: JSON.stringify({ computerId: "bad-id", hours: 0, clientName: "Smoke" }),
  });

  console.log(`Deep smoke OK for ${baseUrl}`);
}

run().catch((error) => {
  console.error("Deep smoke FAILED:", error);
  process.exit(1);
});
