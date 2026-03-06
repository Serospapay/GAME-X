import { spawn } from "node:child_process";

const steps = [
  { name: "build", cmd: "npm", args: ["run", "build"] },
  { name: "smoke", cmd: "npm", args: ["run", "smoke"] },
  { name: "smoke:e2e", cmd: "npm", args: ["run", "smoke:e2e"] },
  { name: "smoke:auth", cmd: "npm", args: ["run", "smoke:auth"] },
];

function runStep(step) {
  return new Promise((resolve, reject) => {
    const child = spawn(step.cmd, step.args, {
      stdio: "inherit",
      shell: true,
      env: process.env,
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

async function run() {
  for (const step of steps) {
    console.log(`\n[qa-full] running ${step.name}...`);
    await runStep(step);
  }
  console.log("\n[qa-full] all checks passed");
}

run().catch((error) => {
  console.error("[qa-full] failed:", error);
  process.exit(1);
});
