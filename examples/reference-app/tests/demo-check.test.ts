import { describe, expect, it } from "vitest";

import { runDemoCheck } from "../scripts/demo-check.js";

describe("runDemoCheck", () => {
  it("verifies health, dashboard auth, MCP auth, and signal ingest visibility", async () => {
    const state = {
      summary: {
        signals: 0,
        prospects: 0,
      },
      recentSignals: [] as Array<Record<string, unknown>>,
    };

    const fetchImpl: typeof fetch = (async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

      if (url.pathname === "/healthz") {
        return jsonResponse(200, {
          ok: true,
          service: "trellis",
          localSmokeMode: false,
        });
      }

      if (url.pathname === "/api/dashboard/core-state" && !headers.get("cookie")) {
        return jsonResponse(401, { error: "unauthorized" });
      }

      if (url.pathname === "/dashboard/login" && method === "POST") {
        return new Response("", {
          status: 302,
          headers: {
            "set-cookie": "trellis_dashboard_auth=test-cookie; Path=/; HttpOnly",
            location: "/dashboard",
          },
        });
      }

      if ((url.pathname === "/api/dashboard/state" || url.pathname === "/api/dashboard/core-state") && headers.get("cookie")) {
        return jsonResponse(200, state);
      }

      if (url.pathname === "/mcp/trellis" && method === "POST" && !headers.get("authorization")) {
        return jsonResponse(401, { error: "unauthorized" });
      }

      if (url.pathname === "/mcp/trellis" && method === "POST" && headers.get("authorization") === "Bearer mcp-token") {
        return jsonResponse(200, {
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2025-03-26",
          },
        });
      }

      if (url.pathname === "/webhooks/signals" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, any>;
        state.summary.signals += 1;
        state.summary.prospects += 1;
        state.recentSignals.unshift({
          url: body.signal?.url,
          topic: body.signal?.topic ?? null,
        });
        return jsonResponse(200, {
          ok: true,
          signalsReceived: 1,
        });
      }

      return jsonResponse(404, { error: "not found", path: url.pathname });
    }) as typeof fetch;

    const result = await runDemoCheck({
      baseUrl: "http://127.0.0.1:3000",
      dashboardPassword: "dev",
      mcpToken: "mcp-token",
      signalSecret: "signal-secret",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.steps).toEqual([
      expect.objectContaining({ key: "healthz", status: "ok" }),
      expect.objectContaining({ key: "dashboard", status: "ok" }),
      expect.objectContaining({ key: "mcp", status: "ok" }),
      expect.objectContaining({ key: "signal", status: "ok" }),
    ]);
  });

  it("allows a boot-only smoke check without signal ingest", async () => {
    const fetchImpl: typeof fetch = (async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

      if (url.pathname === "/healthz") {
        return jsonResponse(200, {
          ok: true,
          service: "trellis",
          localSmokeMode: true,
        });
      }
      if (url.pathname === "/api/dashboard/core-state" && !headers.get("cookie")) {
        return jsonResponse(401, { error: "unauthorized" });
      }
      if (url.pathname === "/dashboard/login" && method === "POST") {
        return new Response("", {
          status: 302,
          headers: {
            "set-cookie": "trellis_dashboard_auth=test-cookie; Path=/; HttpOnly",
            location: "/dashboard",
          },
        });
      }
      if (url.pathname === "/api/dashboard/state" && headers.get("cookie")) {
        return jsonResponse(200, {
          summary: {
            signals: 0,
            prospects: 0,
          },
          recentSignals: [],
        });
      }
      if (url.pathname === "/mcp/trellis" && method === "POST" && !headers.get("authorization")) {
        return jsonResponse(401, { error: "unauthorized" });
      }
      if (url.pathname === "/mcp/trellis" && method === "POST") {
        return jsonResponse(200, {
          jsonrpc: "2.0",
          id: 1,
          result: {
            protocolVersion: "2025-03-26",
          },
        });
      }
      return jsonResponse(404, { error: "not found", path: url.pathname });
    }) as typeof fetch;

    const result = await runDemoCheck({
      baseUrl: "http://127.0.0.1:3000",
      dashboardPassword: "dev",
      mcpToken: "mcp-token",
      skipIngest: true,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.steps.at(-1)).toEqual(
      expect.objectContaining({ key: "signal", status: "skipped" }),
    );
  });
});

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
