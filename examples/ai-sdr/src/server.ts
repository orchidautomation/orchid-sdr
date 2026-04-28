import { Hono } from "hono";

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
  createDashboardStateController,
  getDashboardPassword as resolveDashboardPassword,
} from "../../../packages/default-sdr/src/dashboard-bootstrap.js";
import {
  buildDefaultSdrDashboardCoreState,
  buildDefaultSdrDashboardRuntimeState,
} from "../../../packages/default-sdr/src/dashboard-state.js";
import {
  mountDefaultSdrDashboardRoutes,
  mountDefaultSdrMcpHttpRoute,
} from "../../../packages/default-sdr/src/http-routes.js";
import { mountDefaultSdrWebhookRoutes } from "../../../packages/default-sdr/src/webhook-bootstrap.js";
import type { DefaultSdrDashboardActorClient } from "../../../packages/default-sdr/src/dashboard-state.js";

export function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const dashboardCookieName = "trellis_dashboard_auth";
  const dashboardState = createDashboardStateController({
    buildCoreState: () => buildDefaultSdrDashboardCoreState(context),
    buildRuntimeState: () =>
      buildDefaultSdrDashboardRuntimeState(context, {
        getActorClient: () => getActorClient() as unknown as DefaultSdrDashboardActorClient,
      }),
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

  const dashboardRoutes = mountDefaultSdrDashboardRoutes(app, {
    dashboardCookieName,
    getPassword: () => getDashboardPassword(context),
    renderLoginPage: renderDashboardLoginPage,
    renderDashboardPage,
    dashboardState,
  });

  app.get("/healthz", async (c) => {
    await context.repository.ensureDefaultCampaign();
    return c.json({
      ok: true,
      service: "trellis",
      localSmokeMode: context.localSmokeMode,
    });
  });

  app.post("/api/dashboard/discovery-tick", async (c) => {
    if (!dashboardRoutes.requireAuth(c.req.raw)) {
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
    if (!dashboardRoutes.requireAuth(c.req.raw)) {
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
    if (!dashboardRoutes.requireAuth(c.req.raw)) {
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

  mountDefaultSdrMcpHttpRoute(app, {
    bearerToken: context.config.mcpToken,
    createServer: () => createTrellisMcpServer(context),
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
