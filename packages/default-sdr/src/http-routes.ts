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

export function mountDefaultSdrRuntimeRoutes(
  app: Hono,
  input: {
    ensureRuntimeBootstrapped(): Promise<void>;
    shouldUseRemoteRivetRuntime(): boolean;
    shouldSkipLocalRivetRuntime(): boolean;
    handleRemoteRivetRequest(request: Request): Promise<Response>;
    localRivetManagerUrl?: string;
    rootRedirectTo?: string;
    healthPath?: string;
    getHealth(): Promise<Record<string, unknown>>;
  },
) {
  const localManagerBaseUrl = input.localRivetManagerUrl ?? "http://127.0.0.1:6420";
  const rootRedirectTo = input.rootRedirectTo ?? "/dashboard";
  const healthPath = input.healthPath ?? "/healthz";

  app.all("/api/rivet", (c) => handleRivetRequest(c.req.raw));
  app.all("/api/rivet/*", (c) => handleRivetRequest(c.req.raw));

  app.use("*", async (c, next) => {
    if (!shouldBypassRuntimeBootstrap(c.req.raw, healthPath)) {
      await input.ensureRuntimeBootstrapped();
    }
    await next();
  });

  app.get("/", (c) => c.redirect(rootRedirectTo));

  app.get(healthPath, async (c) => c.json(await input.getHealth()));

  return {
    shouldBypassRuntimeBootstrap: (request: Request) => shouldBypassRuntimeBootstrap(request, healthPath),
  };

  async function handleRivetRequest(request: Request) {
    if (input.shouldUseRemoteRivetRuntime()) {
      return input.handleRemoteRivetRequest(request);
    }

    if (input.shouldSkipLocalRivetRuntime()) {
      return new Response(
        JSON.stringify({
          error: "RIVET_ENDPOINT is required when trellis runs on Vercel.",
        }),
        {
          status: 503,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }

    return proxyLocalRivetManagerRequest(request, localManagerBaseUrl);
  }
}

async function proxyLocalRivetManagerRequest(request: Request, managerBaseUrl: string) {
  const incomingUrl = new URL(request.url);
  const managerUrl = new URL(`${managerBaseUrl}${stripRivetPrefix(incomingUrl.pathname)}${incomingUrl.search}`);
  return await fetch(
    new Request(managerUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      duplex: request.method === "GET" || request.method === "HEAD" ? undefined : "half",
      redirect: "manual",
    }),
  );
}

function stripRivetPrefix(pathname: string) {
  if (pathname === "/api/rivet") {
    return "/";
  }

  if (pathname.startsWith("/api/rivet/")) {
    const stripped = pathname.slice("/api/rivet".length);
    return stripped.length > 0 ? stripped : "/";
  }

  return pathname;
}

function shouldBypassRuntimeBootstrap(request: Request, healthPath: string) {
  const { pathname } = new URL(request.url);

  return pathname === "/"
    || pathname === "/dashboard"
    || pathname === "/dashboard/login"
    || pathname === "/dashboard/logout"
    || pathname === healthPath
    || pathname === "/api/rivet"
    || pathname.startsWith("/api/rivet/");
}
