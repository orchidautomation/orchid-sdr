import { createHash } from "node:crypto";

import type { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

import { renderDashboardLoginPage, renderDashboardPage } from "../dashboard/page.js";
import type { AppContext } from "../services/runtime-context.js";
import { getActorClient } from "../services/actor-client.js";

export function registerDashboardRoutes(app: Hono, context: AppContext) {
  const dashboardCookieName = "orchid_dashboard_auth";

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

    return c.json(await buildDashboardState(context));
  });

  app.post("/api/dashboard/discovery-tick", async (c) => {
    if (!isDashboardAuthenticated(c.req.raw, dashboardCookieName, getDashboardPassword(context))) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({})) as {
      source?: "linkedin_public_post" | "x_public_post";
    };
    const campaign = await context.repository.ensureDefaultCampaign();
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

    const client = getActorClient();
    const actor = client.sandboxBroker.getOrCreate();
    const job = await actor.enqueueTurn({
      turnId: `dashboard-firecrawl-probe-${Date.now()}`,
      prospectId: "dashboard",
      campaignId: (await context.repository.ensureDefaultCampaign()).id,
      stage: "build_research_brief",
      systemPrompt: "Use available tools when needed. Keep the final answer to one short line.",
      prompt: "Use the Firecrawl MCP server to inspect https://playkit.sh and reply with the page title only.",
      metadata: {
        kind: "dashboard-firecrawl-probe",
      },
    });

    return c.json(job, 202);
  });
}

function getDashboardPassword(context: AppContext) {
  return context.config.DASHBOARD_PASSWORD ?? context.config.ORCHID_SDR_SANDBOX_TOKEN;
}

function hashDashboardPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function isDashboardAuthenticated(request: Request, cookieName: string, password: string) {
  const cookieValue = readCookie(request, cookieName);
  return cookieValue === hashDashboardPassword(password);
}

async function buildDashboardState(context: AppContext) {
  const campaign = await context.repository.ensureDefaultCampaign();
  const client = getActorClient();
  const sandboxActor = client.sandboxBroker.getOrCreate();

  const [
    summary,
    recentSignals,
    recentProspects,
    qualifiedLeads,
    activeThreads,
    providerRuns,
    auditEvents,
    sandboxJobs,
    sourceIngest,
    campaignOps,
    sandboxBroker,
    linkedinDiscovery,
    xDiscovery,
  ] = await Promise.all([
    context.repository.getDashboardSummary(),
    context.repository.listRecentSignals(12),
    context.repository.listRecentProspects(12),
    context.repository.listQualifiedLeads(12),
    context.repository.listActiveThreads(12),
    context.repository.listRecentProviderRuns(12),
    context.repository.listRecentAuditEvents(16),
    sandboxActor.listJobs({ limit: 12 }),
    client.sourceIngest.getOrCreate().getSnapshot().catch(() => null),
    client.campaignOps.getOrCreate().getSnapshot().catch(() => null),
    sandboxActor.getSnapshot().catch(() => null),
    context.config.DISCOVERY_LINKEDIN_ENABLED
      ? client.discoveryCoordinator.getOrCreate([campaign.id, "linkedin_public_post"]).getSnapshot().catch(() => null)
      : Promise.resolve(null),
    context.config.DISCOVERY_X_ENABLED
      ? client.discoveryCoordinator.getOrCreate([campaign.id, "x_public_post"]).getSnapshot().catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    summary,
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
    providerRuns,
    qualifiedLeads,
    activeThreads,
    recentProspects,
    recentSignals,
    auditEvents,
  };
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
