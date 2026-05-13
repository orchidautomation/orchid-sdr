import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { loadProcessEnvFiles } from "@trellis/framework";

loadProcessEnvFiles();

export interface DemoCheckOptions {
  baseUrl: string;
  dashboardPassword?: string | null;
  mcpToken?: string | null;
  signalSecret?: string | null;
  skipDashboard?: boolean;
  skipMcp?: boolean;
  skipIngest?: boolean;
  fetchImpl?: typeof fetch;
}

export interface DemoCheckStep {
  key: "healthz" | "dashboard" | "mcp" | "signal";
  status: "ok" | "warning" | "error" | "skipped";
  detail: string;
  data?: Record<string, unknown>;
}

export interface DemoCheckResult {
  ok: boolean;
  baseUrl: string;
  steps: DemoCheckStep[];
}

const MCP_INITIALIZE_PAYLOAD = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: {
      name: "trellis-demo-check",
      version: "0.1.0",
    },
  },
};

async function main() {
  const args = parseArgs({
    options: {
      "base-url": { type: "string" },
      "dashboard-password": { type: "string" },
      "mcp-token": { type: "string" },
      "signal-secret": { type: "string" },
      "skip-dashboard": { type: "boolean", default: false },
      "skip-mcp": { type: "boolean", default: false },
      "skip-ingest": { type: "boolean", default: false },
    },
  });

  const result = await runDemoCheck({
    baseUrl: String(
      args.values["base-url"]
      ?? process.env.APP_URL
      ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`,
    ),
    dashboardPassword:
      args.values["dashboard-password"]
      ?? process.env.DASHBOARD_PASSWORD
      ?? process.env.TRELLIS_SANDBOX_TOKEN
      ?? "",
    mcpToken:
      args.values["mcp-token"]
      ?? process.env.TRELLIS_MCP_TOKEN
      ?? process.env.TRELLIS_SANDBOX_TOKEN
      ?? "",
    signalSecret:
      args.values["signal-secret"]
      ?? process.env.SIGNAL_WEBHOOK_SECRET
      ?? process.env.APIFY_WEBHOOK_SECRET
      ?? "",
    skipDashboard: args.values["skip-dashboard"],
    skipMcp: args.values["skip-mcp"],
    skipIngest: args.values["skip-ingest"],
  });

  console.log("Checking the Trellis reference app.");

  for (const step of result.steps) {
    const prefix =
      step.status === "ok"
        ? "OK"
        : step.status === "warning"
          ? "WARN"
          : step.status === "skipped"
            ? "SKIP"
            : "ERR";
    console.log(`${prefix} ${step.key}: ${step.detail}`);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

export async function runDemoCheck(options: DemoCheckOptions): Promise<DemoCheckResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const steps: DemoCheckStep[] = [];

  const healthz = await checkHealthz(fetchImpl, baseUrl);
  steps.push(healthz.step);
  if (healthz.step.status === "error") {
    return {
      ok: false,
      baseUrl,
      steps,
    };
  }

  let dashboardCookie = "";
  let baselineDashboardState: Record<string, unknown> | null = null;

  if (options.skipDashboard) {
    steps.push({
      key: "dashboard",
      status: "skipped",
      detail: "dashboard checks skipped by caller",
    });
  } else {
    assertOk(Boolean(options.dashboardPassword), "dashboard password is required");
    const dashboard = await checkDashboard(fetchImpl, baseUrl, String(options.dashboardPassword));
    steps.push(dashboard.step);
    if (dashboard.step.status === "error") {
      return {
        ok: false,
        baseUrl,
        steps,
      };
    }
    dashboardCookie = dashboard.cookieHeader;
    baselineDashboardState = dashboard.state;
  }

  if (options.skipMcp) {
    steps.push({
      key: "mcp",
      status: "skipped",
      detail: "MCP auth-surface check skipped by caller",
    });
  } else {
    assertOk(Boolean(options.mcpToken), "MCP token is required");
    const mcp = await checkMcp(fetchImpl, baseUrl, String(options.mcpToken));
    steps.push(mcp);
    if (mcp.status === "error") {
      return {
        ok: false,
        baseUrl,
        steps,
      };
    }
  }

  if (options.skipIngest) {
    steps.push({
      key: "signal",
      status: "skipped",
      detail: "signal ingest check skipped by caller",
    });
  } else {
    assertOk(Boolean(options.signalSecret), "signal webhook secret is required");
    const signal = await checkSignalIngest(fetchImpl, baseUrl, {
      dashboardCookie,
      baselineDashboardState,
      signalSecret: String(options.signalSecret),
    });
    steps.push(signal);
  }

  return {
    ok: steps.every((step) => step.status !== "error"),
    baseUrl,
    steps,
  };
}

async function checkHealthz(fetchImpl: typeof fetch, baseUrl: string) {
  const response = await fetchImpl(`${baseUrl}/healthz`);
  const body = await parseMaybeJson(response);
  if (!response.ok || !isRecord(body) || body.ok !== true) {
    return {
      step: {
        key: "healthz" as const,
        status: "error" as const,
        detail: `GET /healthz failed with status ${response.status}`,
        data: {
          response: body,
        },
      },
      body,
    };
  }

  return {
    step: {
      key: "healthz" as const,
      status: "ok" as const,
      detail: "GET /healthz returned ok=true",
      data: {
        service: body.service ?? null,
        localSmokeMode: body.localSmokeMode ?? null,
      },
    },
    body,
  };
}

async function checkDashboard(fetchImpl: typeof fetch, baseUrl: string, password: string) {
  const unauthorized = await fetchImpl(`${baseUrl}/api/dashboard/core-state`);
  if (unauthorized.status !== 401) {
    return {
      step: {
        key: "dashboard" as const,
        status: "error" as const,
        detail: `expected /api/dashboard/core-state without auth to return 401, got ${unauthorized.status}`,
      },
      cookieHeader: "",
      state: null,
    };
  }

  const response = await fetchImpl(`${baseUrl}/dashboard/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    redirect: "manual",
    body: new URLSearchParams({
      password,
    }),
  });

  const setCookie = response.headers.get("set-cookie");
  if (response.status !== 302 || !setCookie) {
    return {
      step: {
        key: "dashboard" as const,
        status: "error" as const,
        detail: `dashboard login failed with status ${response.status}`,
        data: {
          location: response.headers.get("location"),
          body: await parseMaybeJson(response),
        },
      },
      cookieHeader: "",
      state: null,
    };
  }

  const dashboardCookie = String(setCookie).split(";", 1)[0] ?? "";
  const stateResponse = await fetchImpl(`${baseUrl}/api/dashboard/state?fresh=1`, {
    headers: {
      cookie: dashboardCookie,
    },
  });
  const state = await parseMaybeJson(stateResponse);
  if (!stateResponse.ok || !isRecord(state)) {
    return {
      step: {
        key: "dashboard" as const,
        status: "error" as const,
        detail: `/api/dashboard/state failed with status ${stateResponse.status}`,
      },
      cookieHeader: dashboardCookie,
      state: null,
    };
  }

  return {
    step: {
      key: "dashboard" as const,
      status: "ok" as const,
      detail: "dashboard login and state read succeeded",
      data: {
        signals: readSummaryCount(state, "signals"),
        prospects: readSummaryCount(state, "prospects"),
      },
    },
    cookieHeader: dashboardCookie,
    state,
  };
}

async function checkMcp(fetchImpl: typeof fetch, baseUrl: string, token: string): Promise<DemoCheckStep> {
  const unauthorized = await fetchImpl(`${baseUrl}/mcp/trellis`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(MCP_INITIALIZE_PAYLOAD),
  });
  if (unauthorized.status !== 401) {
    return {
      key: "mcp",
      status: "error",
      detail: `expected unauthorized MCP request to return 401, got ${unauthorized.status}`,
    };
  }

  const response = await fetchImpl(`${baseUrl}/mcp/trellis`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(MCP_INITIALIZE_PAYLOAD),
  });
  const body = await parseMaybeJson(response);

  if (response.status === 401) {
    return {
      key: "mcp",
      status: "error",
      detail: "authorized MCP initialize still returned 401",
    };
  }

  return {
    key: "mcp",
    status: response.ok ? "ok" : "warning",
    detail: response.ok
      ? "authorized MCP initialize reached /mcp/trellis"
      : `authorized MCP initialize reached /mcp/trellis but returned ${response.status}`,
    data: isRecord(body)
      ? {
          jsonrpc: body.jsonrpc ?? null,
          hasResult: Object.hasOwn(body, "result"),
          hasError: Object.hasOwn(body, "error"),
        }
      : undefined,
  };
}

async function checkSignalIngest(
  fetchImpl: typeof fetch,
  baseUrl: string,
  input: {
    dashboardCookie: string;
    baselineDashboardState: Record<string, unknown> | null;
    signalSecret: string;
  },
): Promise<DemoCheckStep> {
  if (!input.dashboardCookie || !input.baselineDashboardState) {
    return {
      key: "signal",
      status: "warning",
      detail: "signal ingest check skipped dashboard visibility verification because dashboard auth was skipped",
    };
  }

  const demoUrl = `https://example.com/demo/${Date.now()}`;
  const response = await fetchImpl(
    `${baseUrl}/webhooks/signals?secret=${encodeURIComponent(input.signalSecret)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider: "manual",
        source: "warm_form",
        signal: {
          url: demoUrl,
          authorName: "Demo Buyer",
          authorTitle: "VP Revenue",
          authorCompany: "Northstar",
          companyDomain: "northstar.ai",
          topic: "demo request",
          content: "We want to automate account research.",
          capturedAt: new Date().toISOString(),
          metadata: {
            demo: true,
          },
        },
      }),
    },
  );
  const ingestBody = await parseMaybeJson(response);
  const refreshed = await pollDashboardState(fetchImpl, baseUrl, input.dashboardCookie, input.baselineDashboardState, demoUrl)
    .catch(() => null);

  if (response.ok && refreshed) {
    return {
      key: "signal",
      status: "ok",
      detail: "signal webhook succeeded and dashboard state reflected the new signal",
      data: {
        ingestStatus: response.status,
        signals: readSummaryCount(refreshed, "signals"),
        prospects: readSummaryCount(refreshed, "prospects"),
      },
    };
  }

  if (refreshed) {
    return {
      key: "signal",
      status: "warning",
      detail: `signal became visible in dashboard state, but webhook returned ${response.status}`,
      data: {
        ingestStatus: response.status,
        ingestResponse: ingestBody,
        signals: readSummaryCount(refreshed, "signals"),
        prospects: readSummaryCount(refreshed, "prospects"),
      },
    };
  }

  return {
    key: "signal",
    status: "error",
    detail: `signal ingest failed before dashboard state reflected it (status ${response.status})`,
    data: {
      ingestResponse: ingestBody,
      hint: "If this is a hosted non-smoke app, the usual cause is missing downstream workflow providers or runtime credentials.",
    },
  };
}

async function pollDashboardState(
  fetchImpl: typeof fetch,
  baseUrl: string,
  dashboardCookie: string,
  baseline: Record<string, unknown>,
  demoUrl: string,
) {
  const baselineSignals = readSummaryCount(baseline, "signals");
  const baselineProspects = readSummaryCount(baseline, "prospects");
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const current = await readJson(fetchImpl, `${baseUrl}/api/dashboard/state?fresh=1`, {
      headers: {
        cookie: dashboardCookie,
      },
    });
    const recentSignals = Array.isArray(current.recentSignals) ? current.recentSignals : [];
    const sawSignal = recentSignals.some((entry) =>
      isRecord(entry) && entry.url === demoUrl
    );
    if (
      sawSignal
      || readSummaryCount(current, "signals") > baselineSignals
      || readSummaryCount(current, "prospects") > baselineProspects
    ) {
      return current;
    }

    await sleep(500);
  }

  throw new Error("dashboard state did not reflect the ingested signal before timeout");
}

async function readJson(fetchImpl: typeof fetch, url: string, init?: RequestInit) {
  const response = await fetchImpl(url, init);
  assertOk(response.ok, `request failed for ${url} with status ${response.status}`);
  const json = await parseMaybeJson(response);
  assertOk(isRecord(json), `request for ${url} did not return JSON object`);
  return json;
}

async function parseMaybeJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      raw: text,
    };
  }
}

function readSummaryCount(state: Record<string, unknown> | null, key: string) {
  const summary = state?.summary;
  if (!summary || typeof summary !== "object") {
    return 0;
  }
  const value = (summary as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertOk(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const entryHref = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";

if (import.meta.url === entryHref) {
  void main();
}
