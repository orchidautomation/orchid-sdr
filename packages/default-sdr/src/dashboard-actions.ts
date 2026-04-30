import type { Hono } from "hono";

export interface DefaultSdrDashboardActionMount {
  path: string;
  handle(input: { body: Record<string, unknown> }): Promise<{
    status?: number;
    body: Record<string, unknown>;
  }>;
}

export interface DefaultSdrStandardDashboardActorClient {
  discoveryCoordinator: {
    getOrCreate(key: [string, "linkedin_public_post" | "x_public_post"]): any;
  };
  campaignOps: {
    getOrCreate(key?: unknown): any;
  };
  sandboxBroker: {
    getOrCreate(key?: unknown): any;
  };
}

export function buildDefaultSdrPageTitleSandboxProbeRequest(input: {
  campaignId: string;
  url: string;
  stage?: string;
  metadataKind?: string;
  mcpServerName?: string;
}) {
  const serverName = input.mcpServerName ?? "Firecrawl";

  return {
    turnId: `dashboard-page-title-probe-${Date.now()}`,
    prospectId: "dashboard",
    campaignId: input.campaignId,
    stage: input.stage ?? "build_research_brief",
    systemPrompt: "Use available tools when needed. Keep the final answer to one short line.",
    prompt: `Use the ${serverName} MCP server to inspect ${input.url} and reply with the page title only.`,
    metadata: {
      kind: input.metadataKind ?? "dashboard-page-title-probe",
      url: input.url,
      server: serverName,
    },
  };
}

export function mountDefaultSdrDashboardActionRoutes(
  app: Hono,
  input: {
    requireAuth(request: Request): boolean;
    actions: DefaultSdrDashboardActionMount[];
  },
) {
  for (const action of input.actions) {
    app.post(action.path, async (c) => {
      if (!input.requireAuth(c.req.raw)) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
      const result = await action.handle({ body });
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: {
          "content-type": "application/json",
        },
      });
    });
  }
}

export function buildDefaultSdrStandardDashboardActions(input: {
  localSmokeMode: boolean;
  discoveryLinkedinEnabled: boolean;
  discoveryXEnabled: boolean;
  ensureDefaultCampaign(): Promise<{ id: string }>;
  getControlFlags(): Promise<unknown>;
  getAutomationPauseReason(controlFlags: unknown, campaignId: string): string | null;
  getActorClient(): DefaultSdrStandardDashboardActorClient;
  buildSandboxProbeRequest(input: {
    campaignId: string;
  }): {
    turnId: string;
    prospectId: string;
    campaignId: string;
    stage: string;
    systemPrompt: string;
    prompt: string;
    metadata?: Record<string, unknown>;
  };
}) {
  return [
    {
      path: "/api/dashboard/discovery-tick",
      handle: async ({ body }: { body: Record<string, unknown> }) => {
        if (input.localSmokeMode) {
          return {
            status: 409,
            body: { error: "discovery is disabled in local smoke mode" },
          };
        }

        const campaign = await input.ensureDefaultCampaign();
        const automationPauseReason = input.getAutomationPauseReason(
          await input.getControlFlags(),
          campaign.id,
        );
        if (automationPauseReason) {
          return {
            status: 409,
            body: { error: `automation paused: ${automationPauseReason}` },
          };
        }

        const source = body.source === "x_public_post" ? "x_public_post" : "linkedin_public_post";
        const client = input.getActorClient();
        const actor = client.discoveryCoordinator.getOrCreate([campaign.id, source]) as any;
        const result = await actor.enqueueTick({
          reason: "dashboard_manual",
        });

        return {
          status: 202,
          body: {
            ...result,
            source,
          },
        };
      },
    },
    {
      path: "/api/dashboard/sandbox-probe",
      handle: async () => {
        const campaign = await input.ensureDefaultCampaign();
        const automationPauseReason = input.getAutomationPauseReason(
          await input.getControlFlags(),
          campaign.id,
        );
        if (automationPauseReason) {
          return {
            status: 409,
            body: { error: `automation paused: ${automationPauseReason}` },
          };
        }

        const client = input.getActorClient();
        const actor = client.sandboxBroker.getOrCreate() as any;
        const job = await actor.enqueueTurn(input.buildSandboxProbeRequest({
          campaignId: campaign.id,
        }));

        return {
          status: 202,
          body: job,
        };
      },
    },
    {
      path: "/api/dashboard/automation-pause",
      handle: async ({ body }: { body: Record<string, unknown> }) => {
        const paused = Boolean(body.paused);
        const campaign = await input.ensureDefaultCampaign();
        const client = input.getActorClient();
        const actor = client.campaignOps.getOrCreate() as any;
        const discoverySources = [
          ...(input.discoveryLinkedinEnabled ? (["linkedin_public_post"] as const) : []),
          ...(input.discoveryXEnabled ? (["x_public_post"] as const) : []),
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

        return {
          body: {
            paused,
            campaignId: campaign.id,
            ...result,
            discovery: paused ? pausedDiscoveryResults : resumedDiscoveryResults,
            flags: await input.getControlFlags(),
          },
        };
      },
    },
  ] satisfies DefaultSdrDashboardActionMount[];
}
