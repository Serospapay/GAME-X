import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) return;

  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}

loadEnvFile(".env.local");

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const devUserEmail = process.env.DEV_USER_EMAIL;
const devUserPassword = process.env.DEV_USER_PASSWORD;
const devAdminEmail = process.env.DEV_ADMIN_EMAIL;
const devAdminPassword = process.env.DEV_ADMIN_PASSWORD;

if (!devUserEmail || !devUserPassword || !devAdminEmail || !devAdminPassword) {
  throw new Error("Missing DEV_* env credentials required for smoke:auth");
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addFromResponse(response) {
    const withGetSetCookie = response.headers.getSetCookie?.();
    const setCookieHeaders = Array.isArray(withGetSetCookie)
      ? withGetSetCookie
      : [response.headers.get("set-cookie")].filter(Boolean);

    for (const header of setCookieHeaders) {
      const pair = header.split(";")[0];
      const [name, ...valueParts] = pair.split("=");
      if (!name) continue;
      this.cookies.set(name.trim(), valueParts.join("=").trim());
    }
  }

  toHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }
}

async function request(path, init = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

async function loginWithCredentials(email, password) {
  const jar = new CookieJar();

  const csrfRes = await request("/api/auth/csrf");
  if (csrfRes.status !== 200) {
    throw new Error(`csrf status ${csrfRes.status}`);
  }
  jar.addFromResponse(csrfRes);
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson?.csrfToken;
  if (!csrfToken) {
    throw new Error("csrfToken missing");
  }

  const form = new URLSearchParams();
  form.set("csrfToken", csrfToken);
  form.set("email", email);
  form.set("password", password);
  form.set("callbackUrl", `${baseUrl}/`);
  form.set("json", "true");

  const loginRes = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.toHeader(),
    },
    body: form.toString(),
    redirect: "manual",
  });
  jar.addFromResponse(loginRes);
  if (![200, 302].includes(loginRes.status)) {
    const body = await loginRes.text();
    throw new Error(`credentials login failed ${loginRes.status}: ${body}`);
  }

  const sessionRes = await request("/api/auth/session", {
    headers: { cookie: jar.toHeader() },
  });
  if (sessionRes.status !== 200) {
    throw new Error(`session status ${sessionRes.status}`);
  }
  const session = await sessionRes.json();
  if (!session?.user?.email) {
    throw new Error("session user missing after login");
  }
  return { jar, session };
}

async function logout(jar) {
  const csrfRes = await request("/api/auth/csrf", {
    headers: { cookie: jar.toHeader() },
  });
  if (csrfRes.status !== 200) {
    throw new Error(`logout csrf status ${csrfRes.status}`);
  }
  jar.addFromResponse(csrfRes);
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson?.csrfToken;
  if (!csrfToken) {
    throw new Error("logout csrf token missing");
  }

  const form = new URLSearchParams();
  form.set("csrfToken", csrfToken);
  form.set("callbackUrl", `${baseUrl}/`);
  form.set("json", "true");

  const signoutRes = await request("/api/auth/signout", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jar.toHeader(),
    },
    body: form.toString(),
    redirect: "manual",
  });
  if (![200, 302].includes(signoutRes.status)) {
    const body = await signoutRes.text();
    throw new Error(`logout failed ${signoutRes.status}: ${body}`);
  }
  jar.addFromResponse(signoutRes);

  const sessionRes = await request("/api/auth/session", {
    headers: { cookie: jar.toHeader() },
  });
  if (sessionRes.status !== 200) {
    throw new Error(`post-logout session status ${sessionRes.status}`);
  }
  const session = await sessionRes.json();
  if (session?.user?.email) {
    throw new Error("session still authenticated after logout");
  }

  const homePage = await request("/", {
    headers: { cookie: jar.toHeader() },
  });
  if (homePage.status !== 200) {
    throw new Error(`home page after logout status ${homePage.status}`);
  }
}

async function run() {
  const userLogin = await loginWithCredentials(devUserEmail, devUserPassword);
  if (String(userLogin.session.user.email).toLowerCase() !== devUserEmail.toLowerCase()) {
    throw new Error("user session email mismatch");
  }

  const userPersonalization = await request("/api/personalization", {
    headers: { cookie: userLogin.jar.toHeader() },
  });
  if (userPersonalization.status !== 200) {
    throw new Error(`user personalization status ${userPersonalization.status}`);
  }

  const userAdminAudit = await request("/api/admin/audit-logs", {
    headers: { cookie: userLogin.jar.toHeader() },
  });
  if (userAdminAudit.status !== 403) {
    throw new Error(`user should be forbidden for admin audit, got ${userAdminAudit.status}`);
  }
  const userProfilePage = await request("/profile", {
    headers: { cookie: userLogin.jar.toHeader() },
  });
  if (userProfilePage.status !== 200) {
    throw new Error(`user profile status ${userProfilePage.status}`);
  }
  const userProfileHtml = await userProfilePage.text();
  if (!userProfileHtml.includes("Особистий кабінет")) {
    throw new Error("profile page content mismatch");
  }
  const userAdminPage = await request("/admin", {
    headers: { cookie: userLogin.jar.toHeader() },
    redirect: "manual",
  });
  if (![302, 303, 307, 308].includes(userAdminPage.status)) {
    throw new Error(`user admin page must redirect, got ${userAdminPage.status}`);
  }
  await logout(userLogin.jar);

  const adminLogin = await loginWithCredentials(devAdminEmail, devAdminPassword);
  if (String(adminLogin.session.user.email).toLowerCase() !== devAdminEmail.toLowerCase()) {
    throw new Error("admin session email mismatch");
  }

  const adminAudit = await request("/api/admin/audit-logs?limit=5", {
    headers: { cookie: adminLogin.jar.toHeader() },
  });
  if (adminAudit.status !== 200) {
    const body = await adminAudit.text();
    throw new Error(`admin audit status ${adminAudit.status}: ${body}`);
  }
  const adminAuditBody = await adminAudit.json();
  if (!Array.isArray(adminAuditBody?.items)) {
    throw new Error("admin audit items invalid");
  }

  const adminAuditArchive = await request("/api/admin/audit-logs?source=archive&limit=5", {
    headers: { cookie: adminLogin.jar.toHeader() },
  });
  if (adminAuditArchive.status !== 200) {
    const body = await adminAuditArchive.text();
    throw new Error(`admin archive audit status ${adminAuditArchive.status}: ${body}`);
  }
  const adminPage = await request("/admin", {
    headers: { cookie: adminLogin.jar.toHeader() },
  });
  if (adminPage.status !== 200) {
    throw new Error(`admin page status ${adminPage.status}`);
  }
  const adminHtml = await adminPage.text();
  if (!adminHtml.includes("Панель керування")) {
    throw new Error("admin page content mismatch");
  }
  await logout(adminLogin.jar);

  console.log(`Auth smoke OK for ${baseUrl}`);
}

run().catch((error) => {
  console.error("Auth smoke FAILED:", error);
  process.exit(1);
});
