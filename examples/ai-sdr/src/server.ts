import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { renderDashboardLoginPage, renderDashboardPage } from "./dashboard/page.js";
import { registry } from "./registry.js";
import { getAppContext } from "./services/runtime-context.js";
import { getActorClient } from "./services/actor-client.js";
import {
  ensureRuntimeBootstrapped,
  shouldSkipLocalRivetRuntime,
  shouldUseRemoteRivetRuntime,
} from "./services/runtime-bootstrap.js";
import { createTrellisMcpServer } from "./mcp/server-factory.js";
import {
  handleAgentMailWebhook,
  handleHandoffWebhook,
  handleSignalWebhook,
} from "./orchestration/webhook-handlers.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { getAutomationPauseReason } from "./orchestration/workflow-control.js";
import {
  calculateDurationMs,
  createDashboardStateController,
  getDashboardPassword as resolveDashboardPassword,
  hashDashboardPassword as hashDefaultDashboardPassword,
  isDashboardAuthenticated as checkDashboardAuthenticated,
  isSecureRequest,
  withFallback,
} from "../../../packages/default-sdr/src/dashboard-bootstrap.js";
import { mountDefaultSdrWebhookRoutes } from "../../../packages/default-sdr/src/webhook-bootstrap.js";

const DASHBOARD_RUNTIME_TIMEOUT_MS = 1_200;

export function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const dashboardCookieName = "trellis_dashboard_auth";
  const dashboardState = createDashboardStateController({
    buildCoreState: () => buildDashboardCoreState(context),
    buildRuntimeState: () => buildDashboardRuntimeState(context),
  });

  const workflowDeps = {
    context,
    runSandboxTurn: (request: Parameters<typeof runSandboxTurn>[1]) => runSandboxTurn(context, request),
  };

  app.all("/api/rivet", (c) => handleRivetRequest(c.req.raw));
  app.all("/api/rivet/*", (c) => handleRivetRequest(c.req.raw));

  app.use("*", async (_c, next) => {
    if (!shouldBypassRuntimeBootstrap(_c.req.raw)) {
      await ensureRuntimeBootstrapped();
    }
    await next();
  });

  app.get("/", (c) => c.redirect("/dashboard"));

  app.get("/dashboard", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.html(renderDashboardLoginPage());
    }

    return c.html(renderDashboardPage());
  });

  app.post("/dashboard/login", async (c) => {
    const body = await c.req.parseBody();
    const password = typeof body.password === "string" ? body.password : "";
    const expectedPassword = getDashboardPassword(context);

    if (password !== expectedPassword) {
      return c.html(renderDashboardLoginPage({ error: "Invalid password." }), 401);
    }

    setCookie(c, dashboardCookieName, hashDashboardPassword(expectedPassword), {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      secure: isSecureRequest(c.req.raw),
      maxAge: 60 * 60 * 24 * 14,
    });

    return c.redirect("/dashboard");
  });

  app.post("/dashboard/logout", (c) => {
    deleteCookie(c, dashboardCookieName, {
      path: "/",
    });

    return c.redirect("/dashboard");
  });

  app.get("/healthz", async (c) => {
    await context.repository.ensureDefaultCampaign();
    return c.json({
      ok: true,
      service: "trellis",
      localSmokeMode: context.localSmokeMode,
    });
  });

  app.get("/api/dashboard/state", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await dashboardState.getState({
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.get("/api/dashboard/core-state", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await dashboardState.getCoreState({
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.get("/api/dashboard/runtime-state", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await dashboardState.getRuntimeState({
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.post("/api/dashboard/discovery-tick", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (context.localSmokeMode) {
      return c.json({ error: "discovery is disabled in local smoke mode" }, 409);
    }

    const body = await c.req.json().catch(() => ({})) as {
      source?: "linkedin_public_post" | "x_public_post";
    };
    const campaign = await context.repository.ensureDefaultCampaign();
    const automationPauseReason = getAutomationPauseReason(
      await context.repository.getControlFlags(),
      campaign.id,
    );
    if (automationPauseReason) {
      return c.json({ error: `automation paused: ${automationPauseReason}` }, 409);
    }
    const source = body.source === "x_public_post" ? "x_public_post" : "linkedin_public_post";
    const client = getActorClient();
    const actor = client.discoveryCoordinator.getOrCreate([campaign.id, source]) as any;
    const result = await actor.enqueueTick({
      reason: "dashboard_manual",
    });

    return c.json({
      ...result,
      source,
    }, 202);
  });

  app.post("/api/dashboard/sandbox-probe", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const campaign = await context.repository.ensureDefaultCampaign();
    const automationPauseReason = getAutomationPauseReason(
      await context.repository.getControlFlags(),
      campaign.id,
    );
    if (automationPauseReason) {
      return c.json({ error: `automation paused: ${automationPauseReason}` }, 409);
    }

    const client = getActorClient();
    const actor = client.sandboxBroker.getOrCreate() as any;
    const job = await actor.enqueueTurn({
      turnId: `dashboard-firecrawl-probe-${Date.now()}`,
      prospectId: "dashboard",
      campaignId: campaign.id,
      stage: "build_research_brief",
      systemPrompt: "Use available tools when needed. Keep the final answer to one short line.",
      prompt: "Use the Firecrawl MCP server to inspect https://playkit.sh and reply with the page title only.",
      metadata: {
        kind: "dashboard-firecrawl-probe",
      },
    });

    return c.json(job, 202);
  });

  app.post("/api/dashboard/automation-pause", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({})) as {
      paused?: boolean;
    };
    const paused = Boolean(body.paused);
    const campaign = await context.repository.ensureDefaultCampaign();
    const client = getActorClient();
    const actor = client.campaignOps.getOrCreate() as any;
    const discoverySources = [
      ...(context.config.DISCOVERY_LINKEDIN_ENABLED ? (["linkedin_public_post"] as const) : []),
      ...(context.config.DISCOVERY_X_ENABLED ? (["x_public_post"] as const) : []),
    ];
    const result = paused
      ? await actor.pauseCampaign(campaign.id)
      : await actor.resumeCampaign(campaign.id);
    const pausedDiscoveryResults = paused
      ? await Promise.all(
        discoverySources.map(async (source) => {
          const coordinator = client.discoveryCoordinator.getOrCreate([campaign.id, source]) as any;
          const pauseResult = await coordinator.pauseAutomation({
            campaignId: campaign.id,
            source,
          });
          return {
            source,
            sourcePaused: pauseResult.ok === true,
          };
        }),
      )
      : [];
    const resumedDiscoveryResults = paused
      ? []
      : await Promise.all(
        discoverySources.map(async (source) => {
          const coordinator = client.discoveryCoordinator.getOrCreate([campaign.id, source]) as any;
          const resumeResult = await coordinator.initialize({
            campaignId: campaign.id,
            source,
            runNow: false,
          });
          return {
            source,
            scheduledNextTickAt: resumeResult.scheduledNextTickAt ?? null,
          };
        }),
      );

    return c.json({
      paused,
      campaignId: campaign.id,
      ...result,
      discovery: paused ? pausedDiscoveryResults : resumedDiscoveryResults,
      flags: await context.repository.getControlFlags(),
    });
  });

  app.all("/mcp/trellis", async (c) => {
    const authorization = c.req.header("authorization");
    if (authorization !== `Bearer ${context.config.mcpToken}`) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const server = createTrellisMcpServer(context);
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

  mountDefaultSdrWebhookRoutes(app, {
    context: {
      config: {
        APIFY_WEBHOOK_SECRET: context.config.APIFY_WEBHOOK_SECRET ?? "",
        SIGNAL_WEBHOOK_SECRET: context.config.SIGNAL_WEBHOOK_SECRET,
      },
      repository: context.repository,
      security: {
        verifySharedSecretHeader: context.security.verifySharedSecretHeader,
        verifyAgentMailWebhook: (rawBody, headers) => context.security.verifyAgentMailWebhook(rawBody, headers as any),
        verifyHandoffSignature: context.security.verifyHandoffSignature,
      },
      providers: context.providers,
    },
    handlers: {
      onApifyRunCompleted: async (payload) => {
        const client = getActorClient();
        const actor = client.discoveryCoordinator.getOrCreate([payload.campaignId, payload.source]) as any;
        return actor.handleApifyRunCompleted(payload);
      },
      onSignal: async (payload) => handleSignalWebhook(workflowDeps, payload),
      onAgentMail: async (payload) => handleAgentMailWebhook(workflowDeps, payload),
      onHandoff: async (payload) => handleHandoffWebhook(workflowDeps, payload),
    },
  });

  return app;
}

export default createApp();

async function proxyRivetManagerRequest(request: Request) {
  const incomingUrl = new URL(request.url);
  const managerUrl = new URL(`http://127.0.0.1:6420${stripRivetPrefix(incomingUrl.pathname)}${incomingUrl.search}`);
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

async function handleRivetRequest(request: Request) {
  if (shouldUseRemoteRivetRuntime()) {
    return registry.handler(request);
  }

  if (shouldSkipLocalRivetRuntime()) {
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

  return proxyRivetManagerRequest(request);
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

function shouldBypassRuntimeBootstrap(request: Request) {
  const { pathname } = new URL(request.url);

  return pathname === "/"
    || pathname === "/dashboard"
    || pathname === "/dashboard/login"
    || pathname === "/dashboard/logout"
    || pathname === "/healthz"
    || pathname === "/api/rivet"
    || pathname.startsWith("/api/rivet/");
}

function getDashboardPassword(context: ReturnType<typeof getAppContext>) {
  return resolveDashboardPassword({
    dashboardPassword: context.config.DASHBOARD_PASSWORD,
    sandboxToken: context.config.TRELLIS_SANDBOX_TOKEN,
  });
}

function hashDashboardPassword(password: string) {
  return hashDefaultDashboardPassword(password);
}

function isDashboardAuthenticated(request: Request, cookieName: string, password: string) {
  return checkDashboardAuthenticated(request, cookieName, password);
}

async function buildDashboardCoreState(context: ReturnType<typeof getAppContext>) {
  const campaign = await context.repository.ensureDefaultCampaign();

  const [
    summary,
    recentSignals,
    recentProspects,
    qualifiedLeads,
    activeThreads,
    providerRuns,
    auditEvents,
    controls,
  ] = await Promise.all([
    context.repository.getDashboardSummary(),
    context.repository.listRecentSignals(12),
    context.repository.listRecentProspects(12),
    context.repository.listQualifiedLeads(12),
    context.repository.listActiveThreads(12),
    context.repository.listRecentProviderRuns(12),
    context.repository.listRecentAuditEvents(16),
    context.repository.getControlFlags(),
  ]);

  return {
    campaignId: campaign.id,
    localSmokeMode: context.localSmokeMode,
    generatedAt: new Date().toISOString(),
    summary,
    controls,
    providerRuns,
    qualifiedLeads,
    activeThreads,
    recentProspects,
    recentSignals,
    auditEvents,
  };
}

async function buildDashboardRuntimeState(context: ReturnType<typeof getAppContext>) {
  const campaign = await context.repository.ensureDefaultCampaign();
  const client = getActorClient();
  const sandboxActor = client.sandboxBroker.getOrCreate() as any;

  const [
    sandboxJobs,
    sourceIngest,
    campaignOps,
    sandboxBroker,
    linkedinDiscovery,
    xDiscovery,
  ] = await Promise.all([
    withFallback(sandboxActor.listJobs({ limit: 12 }), [], DASHBOARD_RUNTIME_TIMEOUT_MS),
    withFallback((client.sourceIngest.getOrCreate() as any).getSnapshot(), null, DASHBOARD_RUNTIME_TIMEOUT_MS),
    withFallback((client.campaignOps.getOrCreate() as any).getSnapshot(), null, DASHBOARD_RUNTIME_TIMEOUT_MS),
    withFallback((sandboxActor as any).getSnapshot(), null, DASHBOARD_RUNTIME_TIMEOUT_MS),
    context.config.DISCOVERY_LINKEDIN_ENABLED
      ? withFallback(
        (client.discoveryCoordinator.getOrCreate([campaign.id, "linkedin_public_post"]) as any).getSnapshot(),
        null,
        DASHBOARD_RUNTIME_TIMEOUT_MS,
      )
      : Promise.resolve(null),
    context.config.DISCOVERY_X_ENABLED
      ? withFallback(
        (client.discoveryCoordinator.getOrCreate([campaign.id, "x_public_post"]) as any).getSnapshot(),
        null,
        DASHBOARD_RUNTIME_TIMEOUT_MS,
      )
      : Promise.resolve(null),
  ]);

  return {
    campaignId: campaign.id,
    localSmokeMode: context.localSmokeMode,
    generatedAt: new Date().toISOString(),
    actors: {
      sourceIngest,
      campaignOps,
      sandboxBroker,
    },
    discovery: {
      linkedin_public_post: linkedinDiscovery,
      x_public_post: xDiscovery,
    },
    sandboxJobs: sandboxJobs.map((job: any) => ({
      ...job,
      durationMs: calculateDurationMs(job.startedAt, job.completedAt),
    })),
  };
}
