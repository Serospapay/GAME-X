import { spawn } from "node:child_process";
import { createServer } from "node:net";

const buildStep = { name: "build", cmd: "npm", args: ["run", "build"] };
const smokeSteps = [
  { name: "smoke", cmd: "npm", args: ["run", "smoke"] },
  { name: "smoke:e2e", cmd: "npm", args: ["run", "smoke:e2e"] },
  { name: "smoke:auth", cmd: "npm", args: ["run", "smoke:auth"] },
];
const qaPort = Number.parseInt(process.env.QA_PORT ?? "3100", 10);

function runStep(step, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(step.cmd, step.args, {
      stdio: "inherit",
      shell: true,
      env,
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${step.name} failed with code ${code ?? "unknown"}`));
      }
    });
    child.on("error", reject);
  });
}

function waitForExit(child, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      resolve(false);
    }, timeoutMs);

    child.once("exit", () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(true);
    });
  });
}

function killProcessTree(pid) {
  if (process.platform !== "win32") return Promise.resolve();
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      shell: true,
      stdio: "ignore",
    });
    killer.on("exit", () => resolve());
    killer.on("error", () => resolve());
  });
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", (error) => {
      const withCode = error;
      if (withCode && withCode.code === "EADDRINUSE") {
        resolve(findFreePort(startPort + 1));
      } else {
        reject(error);
      }
    });
    probe.listen(startPort, () => {
      const address = probe.address();
      const freePort = typeof address === "object" && address ? address.port : startPort;
      probe.close(() => resolve(freePort));
    });
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "start", "--", "--port", String(port)], {
      shell: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let settled = false;
    let stderrBuffer = "";

    const onReady = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (settled) return;
      if (text.includes("Ready in") || text.includes("Local:")) {
        settled = true;
        resolve(child);
      }
    };
    child.stdout.on("data", onReady);
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderrBuffer += text;
      process.stderr.write(text);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      reject(
        new Error(
          `start server exited early (${code ?? "unknown"})${stderrBuffer ? `: ${stderrBuffer}` : ""}`
        )
      );
    });
  });
}

async function waitForHealth(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not become healthy in ${timeoutMs}ms: ${url}`);
}

async function stopServer(child) {
  if (!child) return;

  child.kill("SIGTERM");
  const exitedGracefully = await waitForExit(child, 3000);
  if (!exitedGracefully) {
    if (process.platform === "win32" && child.pid) {
      await killProcessTree(child.pid);
    }
    child.kill("SIGKILL");
    await waitForExit(child, 3000);
  }
}

async function run() {
  console.log(`\n[qa-full] running ${buildStep.name}...`);
  await runStep(buildStep);

  const selectedPort = await findFreePort(qaPort);
  const smokeBaseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${selectedPort}`;
  console.log(`\n[qa-full] starting production server on ${smokeBaseUrl}...`);
  const server = await startServer(selectedPort);
  try {
    await waitForHealth(smokeBaseUrl);
    const testEnv = { ...process.env, SMOKE_BASE_URL: smokeBaseUrl };
    for (const step of smokeSteps) {
      console.log(`\n[qa-full] running ${step.name}...`);
      await runStep(step, testEnv);
    }
  } finally {
    await stopServer(server);
  }

  console.log("\n[qa-full] all checks passed");
}

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[qa-full] failed:", error);
    process.exit(1);
  });
