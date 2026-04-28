import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";

import { loadProcessEnvFiles } from "@ai-sdr/framework";

import { runDemoCheck } from "./demo-check.js";

loadProcessEnvFiles();

async function main() {
  const port = process.env.PORT
    ? Number(process.env.PORT)
    : await resolveAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(
    path.resolve(process.cwd(), "node_modules/.bin/tsx"),
    ["examples/ai-sdr/src/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        APP_URL: baseUrl,
        NODE_ENV: process.env.NODE_ENV ?? "development",
        TRELLIS_LOCAL_SMOKE_MODE: "true",
        TRELLIS_SANDBOX_TOKEN: process.env.TRELLIS_SANDBOX_TOKEN ?? "local-sandbox-token",
        TRELLIS_MCP_TOKEN: process.env.TRELLIS_MCP_TOKEN ?? "local-mcp-token",
        HANDOFF_WEBHOOK_SECRET: process.env.HANDOFF_WEBHOOK_SECRET ?? "local-handoff-secret",
        SIGNAL_WEBHOOK_SECRET: process.env.SIGNAL_WEBHOOK_SECRET ?? "local-signal-secret",
        DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD ?? "dev",
        DISCOVERY_LINKEDIN_ENABLED: "false",
        DISCOVERY_X_ENABLED: "false",
        NO_SENDS_MODE: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
  });

  try {
    await waitForHealthz(baseUrl, 20_000);
    const result = await runDemoCheck({
      baseUrl,
      dashboardPassword: process.env.DASHBOARD_PASSWORD ?? "dev",
      mcpToken: process.env.TRELLIS_MCP_TOKEN ?? "local-mcp-token",
      signalSecret: process.env.SIGNAL_WEBHOOK_SECRET ?? "local-signal-secret",
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    child.kill("SIGTERM");
    await waitForExit(child, 5_000);
  }
}

async function waitForHealthz(baseUrl: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // wait
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`timed out waiting for ${baseUrl}/healthz`);
}

async function resolveAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed to resolve dynamic demo port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

void main();

function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number) {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
