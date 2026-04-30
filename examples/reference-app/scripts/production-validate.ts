import { parseArgs } from "node:util";

import { loadProcessEnvFiles } from "@trellis/framework";

import { runDemoCheck } from "./demo-check.js";

loadProcessEnvFiles();

function assertString(value: string | null | undefined, message: string) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

async function login(baseUrl: string, password: string) {
  const response = await fetch(`${baseUrl}/dashboard/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      password,
    }),
    redirect: "manual",
  });

  const cookies = response.headers.get("set-cookie");
  if (!cookies) {
    throw new Error("dashboard login failed: no session cookie returned");
  }

  return cookies.split(",").map((entry) => (entry.split(";")[0] ?? "").trim()).join("; ");
}

async function loadCoreState(baseUrl: string, cookie: string) {
  const response = await fetch(`${baseUrl}/api/dashboard/core-state`, {
    headers: {
      cookie,
    },
  });

  if (!response.ok) {
    throw new Error(`dashboard core-state failed with status ${response.status}`);
  }

  return response.json() as Promise<Record<string, any>>;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs({
    options: {
      "base-url": { type: "string" },
      "dashboard-password": { type: "string" },
      "mcp-token": { type: "string" },
      "signal-secret": { type: "string" },
      "settle-seconds": { type: "string" },
    },
  });

  const baseUrl = String(
    args.values["base-url"]
    ?? process.env.APP_URL
    ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`,
  ).replace(/\/$/, "");
  const dashboardPassword = assertString(
    args.values["dashboard-password"] ?? process.env.DASHBOARD_PASSWORD ?? process.env.TRELLIS_SANDBOX_TOKEN,
    "dashboard password is required",
  );
  const mcpToken = assertString(
    args.values["mcp-token"] ?? process.env.TRELLIS_MCP_TOKEN ?? process.env.TRELLIS_SANDBOX_TOKEN,
    "MCP token is required",
  );
  const signalSecret = assertString(
    args.values["signal-secret"] ?? process.env.SIGNAL_WEBHOOK_SECRET ?? process.env.APIFY_WEBHOOK_SECRET,
    "signal webhook secret is required",
  );
  const settleSeconds = Number(args.values["settle-seconds"] ?? "30");

  const startedAt = Date.now();
  const demo = await runDemoCheck({
    baseUrl,
    dashboardPassword,
    mcpToken,
    signalSecret,
  });

  const cookie = await login(baseUrl, dashboardPassword);
  let latestState = await loadCoreState(baseUrl, cookie);
  const deadline = Date.now() + (settleSeconds * 1000);

  while (Date.now() < deadline) {
    const freshPending = (latestState.recentProspects ?? []).filter((row: any) => {
      const updatedAt = Date.parse(String(row.updatedAt ?? ""));
      return (
        updatedAt >= startedAt - 60_000
        && row.stage === "capture_signal"
        && row.status === "active"
        && !row.qualification
        && !row.pausedReason
      );
    });

    if (freshPending.length === 0) {
      break;
    }

    await sleep(2_000);
    latestState = await loadCoreState(baseUrl, cookie);
  }

  const freshProspects = (latestState.recentProspects ?? []).filter((row: any) => {
    const updatedAt = Date.parse(String(row.updatedAt ?? ""));
    return updatedAt >= startedAt - 60_000;
  });
  const stuckFreshProspects = freshProspects.filter((row: any) =>
    row.stage === "capture_signal"
    && row.status === "active"
    && !row.qualification
    && !row.pausedReason,
  );
  const recentQualifiedWithoutResearch = (latestState.qualifiedLeads ?? []).filter((row: any) => {
    const updatedAt = Date.parse(String(row.updatedAt ?? ""));
    return updatedAt >= startedAt - 60_000 && (row.researchConfidence === null || row.researchConfidence === undefined);
  });

  const result = {
    ok: demo.ok && stuckFreshProspects.length === 0,
    demo,
    freshProspectsChecked: freshProspects.length,
    stuckFreshProspects,
    recentQualifiedWithoutResearch,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
