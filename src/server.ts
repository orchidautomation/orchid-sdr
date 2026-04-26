import { createHash } from "node:crypto";

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
import { createOrchidMcpServer } from "./mcp/server-factory.js";
import {
  handleAgentMailWebhook,
  handleHandoffWebhook,
  handleSignalWebhook,
} from "./orchestration/webhook-handlers.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { getAutomationPauseReason } from "./orchestration/workflow-control.js";

const DASHBOARD_CACHE_STALE_AFTER_MS = 8_000;
const DASHBOARD_CACHE_MAX_AGE_MS = 5 * 60_000;
const DASHBOARD_RUNTIME_CACHE_STALE_AFTER_MS = 15_000;
const DASHBOARD_RUNTIME_TIMEOUT_MS = 1_200;

let cachedDashboardCoreState: Awaited<ReturnType<typeof buildDashboardCoreState>> | null = null;
let cachedDashboardCoreStateAt = 0;
let dashboardCoreStateRefreshPromise: Promise<Awaited<ReturnType<typeof buildDashboardCoreState>>> | null = null;
let cachedDashboardRuntimeState: Awaited<ReturnType<typeof buildDashboardRuntimeState>> | null = null;
let cachedDashboardRuntimeStateAt = 0;
let dashboardRuntimeStateRefreshPromise: Promise<Awaited<ReturnType<typeof buildDashboardRuntimeState>>> | null = null;

export function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const dashboardCookieName = "orchid_dashboard_auth";

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
      service: "orchid-sdr",
    });
  });

  app.get("/api/dashboard/state", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await getDashboardState(context, {
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.get("/api/dashboard/core-state", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await getDashboardCoreState(context, {
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.get("/api/dashboard/runtime-state", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    return c.json(await getDashboardRuntimeState(context, {
      forceFresh: c.req.query("fresh") === "1",
    }));
  });

  app.post("/api/dashboard/discovery-tick", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
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
    const actor = client.discoveryCoordinator.getOrCreate([campaign.id, source]);
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
    const actor = client.sandboxBroker.getOrCreate();
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
    const actor = client.campaignOps.getOrCreate();
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
          const coordinator = client.discoveryCoordinator.getOrCreate([campaign.id, source]);
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
          const coordinator = client.discoveryCoordinator.getOrCreate([campaign.id, source]);
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

  app.all("/mcp/orchid-sdr", async (c) => {
    const authorization = c.req.header("authorization");
    if (authorization !== `Bearer ${context.config.mcpToken}`) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const server = createOrchidMcpServer(context);
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

  app.post("/webhooks/apify", async (c) => {
    const rawBody = await c.req.text();
    const expected = context.config.APIFY_WEBHOOK_SECRET;
    const provided = c.req.header("x-orchid-webhook-secret") ?? c.req.query("secret");
    if (!context.security.verifySharedSecretHeader(provided ?? null, expected)) {
      return c.json({ error: "invalid secret" }, 401);
    }

    const json = JSON.parse(rawBody) as {
      eventType: string;
      source?: string;
      term?: string;
      campaignId?: string;
      metadata?: Record<string, unknown>;
      resource?: {
        actorRunId?: string;
        id?: string;
        defaultDatasetId?: string;
      };
    };

    if (!json.eventType.includes("SUCCEEDED")) {
      return c.json({
        ok: true,
        ignored: true,
        reason: `unsupported event type ${json.eventType}`,
      });
    }

    const source =
      json.source === "x_public_post" || json.source === "linkedin_public_post"
        ? json.source
        : "linkedin_public_post";
    const actorRunId = json.resource?.actorRunId ?? json.resource?.id ?? "";
    if (!actorRunId) {
      return c.json({ error: "missing actorRunId" }, 400);
    }
    const campaign = json.campaignId ?? (await context.repository.ensureDefaultCampaign()).id;
    const client = getActorClient();
    const actor = client.discoveryCoordinator.getOrCreate([campaign, source]);
    const result = await actor.handleApifyRunCompleted({
      actorRunId,
      defaultDatasetId: json.resource?.defaultDatasetId ?? null,
      source,
      campaignId: campaign,
      term: json.term ?? null,
      metadata: json.metadata ?? {},
    });
    return c.json(result);
  });

  app.post("/webhooks/signals", async (c) => {
    const rawBody = await c.req.text();
    const expected = context.config.SIGNAL_WEBHOOK_SECRET ?? context.config.APIFY_WEBHOOK_SECRET;
    const provided = c.req.header("x-orchid-webhook-secret") ?? c.req.query("secret");
    if (!context.security.verifySharedSecretHeader(provided ?? null, expected)) {
      return c.json({ error: "invalid secret" }, 401);
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const result = await handleSignalWebhook(workflowDeps, {
      provider: readString(json, ["provider"]) ?? "webhook",
      source: readString(json, ["source"]) ?? "other",
      campaignId: readString(json, ["campaignId", "campaign_id"]) ?? undefined,
      externalId: readString(json, ["externalId", "external_id", "runId", "run_id"]) ?? null,
      term: readString(json, ["term", "query", "keyword"]) ?? null,
      metadata: (json.metadata && typeof json.metadata === "object" && !Array.isArray(json.metadata))
        ? json.metadata as Record<string, unknown>
        : {},
      signal: (json.signal && typeof json.signal === "object" && !Array.isArray(json.signal))
        ? json.signal as Record<string, unknown>
        : undefined,
      signals: Array.isArray(json.signals)
        ? json.signals.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value)))
        : undefined,
    });

    return c.json(result);
  });

  app.post("/webhooks/agentmail", async (c) => {
    const rawBody = await c.req.text();
    const headers = {
      "svix-id": c.req.header("svix-id"),
      "svix-timestamp": c.req.header("svix-timestamp"),
      "svix-signature": c.req.header("svix-signature"),
    };
    if (!context.security.verifyAgentMailWebhook(rawBody, headers)) {
      return c.json({ error: "invalid signature" }, 401);
    }

    const json = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = readString(json, ["event_type", "type"]) ?? "";
    const message = (json.message && typeof json.message === "object" ? json.message : {}) as Record<string, unknown>;
    const thread = (json.thread && typeof json.thread === "object" ? json.thread : {}) as Record<string, unknown>;
    const payload = (json.payload && typeof json.payload === "object" ? json.payload : {}) as Record<string, unknown>;
    const inboxId =
      readString(message, ["inbox_id", "inboxId"])
      ?? readString(thread, ["inbox_id", "inboxId"])
      ?? readString(payload, ["inboxId", "inbox_id"]);
    const threadId =
      readString(message, ["thread_id", "threadId"])
      ?? readString(thread, ["thread_id", "threadId"])
      ?? readString(json, ["threadId", "thread_id"])
      ?? readString(payload, ["threadId", "thread_id"]);
    const messageId =
      readString(message, ["message_id", "messageId"])
      ?? readString(json, ["messageId", "message_id"])
      ?? readString(payload, ["messageId", "message_id"]);
    let bodyText =
      readString(message, ["text", "extracted_text", "preview"])
      ?? readString(json, ["bodyText", "body_text", "text"])
      ?? readString(payload, ["bodyText", "body_text", "text"]);

    if (!bodyText && inboxId && messageId && context.providers.email?.isConfigured()) {
      const fullMessage = await context.providers.email.getMessage(inboxId, messageId).catch(() => null);
      bodyText = fullMessage?.bodyText ?? null;
    }

    const result = await handleAgentMailWebhook(workflowDeps, {
      type: eventType,
      inboxId,
      threadId,
      messageId,
      subject:
        readString(message, ["subject"])
        ?? readString(thread, ["subject"])
        ?? readString(json, ["subject"])
        ?? readString(payload, ["subject"]),
      bodyText,
      payload: json,
    });

    return c.json(result ?? { ok: true, ignored: true });
  });

  app.post("/webhooks/handoff", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-orchid-signature");
    if (!context.security.verifyHandoffSignature(rawBody, signature ?? null)) {
      return c.json({ error: "invalid signature" }, 401);
    }

    const json = JSON.parse(rawBody) as {
      threadId: string;
      disposition: string;
      notes?: string;
      actor?: string;
    };

    const result = await handleHandoffWebhook(workflowDeps, json);
    return c.json(result);
  });

  return app;
}

export default createApp();

function readString(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

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
        error: "RIVET_ENDPOINT is required when orchid-sdr runs on Vercel.",
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
  return context.config.DASHBOARD_PASSWORD ?? context.config.ORCHID_SDR_SANDBOX_TOKEN;
}

function hashDashboardPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function isDashboardAuthenticated(request: Request, cookieName: string, password: string) {
  const cookieValue = readCookie(request, cookieName);
  return cookieValue === hashDashboardPassword(password);
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
  const sandboxActor = client.sandboxBroker.getOrCreate();

  const [
    sandboxJobs,
    sourceIngest,
    campaignOps,
    sandboxBroker,
    linkedinDiscovery,
    xDiscovery,
  ] = await Promise.all([
    withFallback(sandboxActor.listJobs({ limit: 12 }), [], DASHBOARD_RUNTIME_TIMEOUT_MS),
    withFallback(client.sourceIngest.getOrCreate().getSnapshot(), null, DASHBOARD_RUNTIME_TIMEOUT_MS),
    withFallback(client.campaignOps.getOrCreate().getSnapshot(), null, DASHBOARD_RUNTIME_TIMEOUT_MS),
    withFallback(sandboxActor.getSnapshot(), null, DASHBOARD_RUNTIME_TIMEOUT_MS),
    context.config.DISCOVERY_LINKEDIN_ENABLED
      ? withFallback(
        client.discoveryCoordinator.getOrCreate([campaign.id, "linkedin_public_post"]).getSnapshot(),
        null,
        DASHBOARD_RUNTIME_TIMEOUT_MS,
      )
      : Promise.resolve(null),
    context.config.DISCOVERY_X_ENABLED
      ? withFallback(
        client.discoveryCoordinator.getOrCreate([campaign.id, "x_public_post"]).getSnapshot(),
        null,
        DASHBOARD_RUNTIME_TIMEOUT_MS,
      )
      : Promise.resolve(null),
  ]);

  return {
    campaignId: campaign.id,
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
    sandboxJobs: sandboxJobs.map((job) => ({
      ...job,
      durationMs: calculateDurationMs(job.startedAt, job.completedAt),
    })),
  };
}

async function getDashboardState(
  context: ReturnType<typeof getAppContext>,
  options?: {
    forceFresh?: boolean;
  },
) {
  const [coreState, runtimeState] = await Promise.all([
    getDashboardCoreState(context, options),
    getDashboardRuntimeState(context, options),
  ]);

  return {
    ...coreState,
    ...runtimeState,
    cache: {
      core: coreState.cache,
      runtime: runtimeState.cache,
      servedFromCache: coreState.cache.servedFromCache && runtimeState.cache.servedFromCache,
      refreshing: coreState.cache.refreshing || runtimeState.cache.refreshing,
    },
  };
}

async function getDashboardCoreState(
  context: ReturnType<typeof getAppContext>,
  options?: {
    forceFresh?: boolean;
  },
) {
  const now = Date.now();
  const forceFresh = options?.forceFresh === true;
  const cacheAgeMs = cachedDashboardCoreState ? now - cachedDashboardCoreStateAt : null;
  const cacheIsUsable = cachedDashboardCoreState !== null
    && cacheAgeMs !== null
    && cacheAgeMs <= DASHBOARD_CACHE_MAX_AGE_MS;
  const cacheIsFresh = cacheIsUsable && cacheAgeMs <= DASHBOARD_CACHE_STALE_AFTER_MS;

  if (forceFresh || !cacheIsUsable) {
    const freshState = await refreshDashboardCoreState(context);
    return {
      ...freshState,
      cache: {
        servedFromCache: false,
        ageMs: 0,
        refreshing: false,
      },
    };
  }

  if (cacheIsFresh) {
    return {
      ...cachedDashboardCoreState,
      cache: {
        servedFromCache: true,
        ageMs: cacheAgeMs,
        refreshing: false,
      },
    };
  }

  void refreshDashboardCoreState(context).catch(() => {});

  return {
    ...cachedDashboardCoreState,
    cache: {
      servedFromCache: true,
      ageMs: cacheAgeMs,
      refreshing: true,
    },
  };
}

async function getDashboardRuntimeState(
  context: ReturnType<typeof getAppContext>,
  options?: {
    forceFresh?: boolean;
  },
) {
  const now = Date.now();
  const forceFresh = options?.forceFresh === true;
  const cacheAgeMs = cachedDashboardRuntimeState ? now - cachedDashboardRuntimeStateAt : null;
  const cacheIsUsable = cachedDashboardRuntimeState !== null
    && cacheAgeMs !== null
    && cacheAgeMs <= DASHBOARD_CACHE_MAX_AGE_MS;
  const cacheIsFresh = cacheIsUsable && cacheAgeMs <= DASHBOARD_RUNTIME_CACHE_STALE_AFTER_MS;

  if (forceFresh || !cacheIsUsable) {
    const freshState = await refreshDashboardRuntimeState(context);
    return {
      ...freshState,
      cache: {
        servedFromCache: false,
        ageMs: 0,
        refreshing: false,
      },
    };
  }

  if (cacheIsFresh) {
    return {
      ...cachedDashboardRuntimeState,
      cache: {
        servedFromCache: true,
        ageMs: cacheAgeMs,
        refreshing: false,
      },
    };
  }

  void refreshDashboardRuntimeState(context).catch(() => {});

  return {
    ...cachedDashboardRuntimeState,
    cache: {
      servedFromCache: true,
      ageMs: cacheAgeMs,
      refreshing: true,
    },
  };
}

function refreshDashboardCoreState(context: ReturnType<typeof getAppContext>) {
  if (dashboardCoreStateRefreshPromise) {
    return dashboardCoreStateRefreshPromise;
  }

  dashboardCoreStateRefreshPromise = buildDashboardCoreState(context)
    .then((state) => {
      cachedDashboardCoreState = state;
      cachedDashboardCoreStateAt = Date.now();
      return state;
    })
    .finally(() => {
      dashboardCoreStateRefreshPromise = null;
    });

  return dashboardCoreStateRefreshPromise;
}

function refreshDashboardRuntimeState(context: ReturnType<typeof getAppContext>) {
  if (dashboardRuntimeStateRefreshPromise) {
    return dashboardRuntimeStateRefreshPromise;
  }

  dashboardRuntimeStateRefreshPromise = buildDashboardRuntimeState(context)
    .then((state) => {
      cachedDashboardRuntimeState = state;
      cachedDashboardRuntimeStateAt = Date.now();
      return state;
    })
    .finally(() => {
      dashboardRuntimeStateRefreshPromise = null;
    });

  return dashboardRuntimeStateRefreshPromise;
}

async function withFallback<T>(input: T | PromiseLike<T>, fallback: Awaited<T>, timeoutMs: number) {
  const promise = Promise.resolve(input);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<Awaited<T>>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function isSecureRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.includes("https");
  }

  return request.url.startsWith("https://");
}

function calculateDurationMs(startedAt: number | null, completedAt: number | null) {
  if (startedAt === null) {
    return null;
  }

  const end = completedAt ?? Date.now();
  return Math.max(0, end - startedAt);
}

function readCookie(request: Request, key: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  for (const chunk of cookieHeader.split(";")) {
    const separatorIndex = chunk.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = chunk.slice(0, separatorIndex).trim();
    if (name !== key) {
      continue;
    }

    return decodeURIComponent(chunk.slice(separatorIndex + 1).trim());
  }

  return undefined;
}
