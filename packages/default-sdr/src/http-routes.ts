import type { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import {
  hashDashboardPassword,
  isDashboardAuthenticated,
  isSecureRequest,
} from "./dashboard-bootstrap.js";

export interface DefaultSdrDashboardStateController {
  getState(input?: { forceFresh?: boolean }): Promise<unknown>;
  getCoreState(input?: { forceFresh?: boolean }): Promise<unknown>;
  getRuntimeState(input?: { forceFresh?: boolean }): Promise<unknown>;
}

export function mountDefaultSdrDashboardRoutes(
  app: Hono,
  input: {
    dashboardCookieName: string;
    getPassword(): string;
    renderLoginPage(input?: { error?: string }): string;
    renderDashboardPage(): string;
    dashboardState: DefaultSdrDashboardStateController;
  },
) {
  const requireAuth = (request: Request) =>
    isDashboardAuthenticated(request, input.dashboardCookieName, input.getPassword());

  app.get("/dashboard", async (c) => {
    if (!requireAuth(c.req.raw)) {
      return c.html(input.renderLoginPage());
    }

    return c.html(input.renderDashboardPage());
  });

  app.post("/dashboard/login", async (c) => {
    const body = await c.req.parseBody();
    const password = typeof body.password === "string" ? body.password : "";
    const expectedPassword = input.getPassword();

    if (password !== expectedPassword) {
      return c.html(input.renderLoginPage({ error: "Invalid password." }), 401);
    }

    setCookie(c, input.dashboardCookieName, hashDashboardPassword(expectedPassword), {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: isSecureRequest(c.req.raw),
      maxAge: 60 * 60 * 24 * 14,
    });

    return c.redirect("/dashboard");
  });

  app.post("/dashboard/logout", (c) => {
    deleteCookie(c, input.dashboardCookieName, {
      path: "/",
    });

    return c.redirect("/dashboard");
  });

  app.get("/api/dashboard/state", async (c) => {
    if (!requireAuth(c.req.raw)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await input.dashboardState.getState({
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.get("/api/dashboard/core-state", async (c) => {
    if (!requireAuth(c.req.raw)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await input.dashboardState.getCoreState({
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.get("/api/dashboard/runtime-state", async (c) => {
    if (!requireAuth(c.req.raw)) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await input.dashboardState.getRuntimeState({
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  return {
    requireAuth,
  };
}

export function mountDefaultSdrMcpHttpRoute(
  app: Hono,
  input: {
    path?: string;
    bearerToken: string;
    createServer(): {
      connect(transport: WebStandardStreamableHTTPServerTransport): Promise<void>;
      close(): Promise<void>;
    };
  },
) {
  app.all(input.path ?? "/mcp/trellis", async (c) => {
    const authorization = c.req.header("authorization");
    if (authorization !== `Bearer ${input.bearerToken}`) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const server = input.createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      await server.close();
    }
  });
}
