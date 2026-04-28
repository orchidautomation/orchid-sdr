import { calculateDurationMs, withFallback } from "./dashboard-bootstrap.js";

export interface DefaultSdrDashboardStateContext {
  localSmokeMode: boolean;
  config: {
    DISCOVERY_LINKEDIN_ENABLED: boolean;
    DISCOVERY_X_ENABLED: boolean;
  };
  repository: {
    ensureDefaultCampaign(): Promise<{ id: string }>;
    getDashboardSummary(): Promise<unknown>;
    listRecentSignals(limit?: number): Promise<unknown[]>;
    listRecentProspects(limit?: number): Promise<unknown[]>;
    listQualifiedLeads(limit?: number): Promise<unknown[]>;
    listActiveThreads(limit?: number): Promise<unknown[]>;
    listRecentProviderRuns(limit?: number): Promise<unknown[]>;
    listRecentAuditEvents(limit?: number): Promise<unknown[]>;
    getControlFlags(): Promise<unknown>;
  };
}

export interface DefaultSdrDashboardActorClient {
  sandboxBroker: {
    getOrCreate(): {
      listJobs(input: { limit: number }): Promise<Array<Record<string, unknown>>>;
      getSnapshot(): Promise<unknown>;
    };
  };
  sourceIngest: {
    getOrCreate(): {
      getSnapshot(): Promise<unknown>;
    };
  };
  campaignOps: {
    getOrCreate(): {
      getSnapshot(): Promise<unknown>;
    };
  };
  discoveryCoordinator: {
    getOrCreate(key: [string, "linkedin_public_post" | "x_public_post"]): {
      getSnapshot(): Promise<unknown>;
    };
  };
}

export async function buildDefaultSdrDashboardCoreState(context: DefaultSdrDashboardStateContext) {
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

export async function buildDefaultSdrDashboardRuntimeState(
  context: DefaultSdrDashboardStateContext,
  input: {
    getActorClient(): DefaultSdrDashboardActorClient;
    timeoutMs?: number;
  },
) {
  const timeoutMs = input.timeoutMs ?? 1_200;
  const campaign = await context.repository.ensureDefaultCampaign();
  const client = input.getActorClient();
  const sandboxActor = client.sandboxBroker.getOrCreate();

  const [
    sandboxJobs,
    sourceIngest,
    campaignOps,
    sandboxBroker,
    linkedinDiscovery,
    xDiscovery,
  ] = await Promise.all([
    withFallback(sandboxActor.listJobs({ limit: 12 }), [], timeoutMs),
    withFallback(client.sourceIngest.getOrCreate().getSnapshot(), null, timeoutMs),
    withFallback(client.campaignOps.getOrCreate().getSnapshot(), null, timeoutMs),
    withFallback(sandboxActor.getSnapshot(), null, timeoutMs),
    context.config.DISCOVERY_LINKEDIN_ENABLED
      ? withFallback(
          client.discoveryCoordinator.getOrCreate([campaign.id, "linkedin_public_post"]).getSnapshot(),
          null,
          timeoutMs,
        )
      : Promise.resolve(null),
    context.config.DISCOVERY_X_ENABLED
      ? withFallback(
          client.discoveryCoordinator.getOrCreate([campaign.id, "x_public_post"]).getSnapshot(),
          null,
          timeoutMs,
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
    sandboxJobs: sandboxJobs.map((job) => ({
      ...job,
      durationMs: calculateDurationMs(
        Number((job as Record<string, unknown>).startedAt ?? null) || null,
        Number((job as Record<string, unknown>).completedAt ?? null) || null,
      ),
    })),
  };
}
