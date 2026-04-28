import type {
  DashboardProspectRow,
  ProspectSnapshot,
  TrellisRepositoryPort,
} from "./repository-contracts.js";

export type DefaultSdrMcpDiscoverySource = "linkedin_public_post" | "x_public_post";

interface DefaultSdrActorClient {
  discoveryCoordinator: {
    getOrCreate(key: [string, DefaultSdrMcpDiscoverySource]): {
      getSnapshot(): Promise<unknown>;
      enqueueTick(input: { reason: string }): Promise<unknown>;
    };
  };
  sandboxBroker: {
    getOrCreate(): {
      listJobs(input: { limit: number }): Promise<Array<Record<string, unknown>>>;
      getSnapshot?(): Promise<unknown>;
    };
  };
  campaignOps: {
    getOrCreate(): {
      getSnapshot(): Promise<unknown>;
      setNoSendsMode(enabled: boolean): Promise<unknown>;
    };
  };
}

export interface DefaultSdrMcpToolContext {
  repository: TrellisRepositoryPort;
  config: {
    DISCOVERY_LINKEDIN_ENABLED: boolean;
    DISCOVERY_X_ENABLED: boolean;
  };
}

export interface DefaultSdrMcpToolDependencies {
  getActorClient(): DefaultSdrActorClient;
}

export class DefaultSdrMcpToolService<Context extends DefaultSdrMcpToolContext> {
  constructor(
    protected readonly context: Context,
    private readonly deps: DefaultSdrMcpToolDependencies,
  ) {}

  async handleTool(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "lead.getContext":
        return this.context.repository.getProspectSnapshot(String(args.prospectId));
      case "lead.inspect":
        return this.handleLeadInspect(args);
      case "lead.updateState":
        return this.handleLeadUpdate(args);
      case "pipeline.summary":
        return this.handlePipelineSummary(args);
      case "pipeline.activeThreads":
        return this.context.repository.listActiveThreads(this.readLimit(args.limit, 12, 50));
      case "pipeline.qualifiedLeads":
        return this.context.repository.listQualifiedLeads(this.readLimit(args.limit, 12, 50));
      case "pipeline.providerRuns":
        return this.context.repository.listRecentProviderRuns(this.readLimit(args.limit, 12, 50));
      case "pipeline.failures":
        return this.handlePipelineFailures(args);
      case "pipeline.workflowFeed":
        return this.context.repository.listRecentAuditEvents(this.readLimit(args.limit, 16, 100));
      case "runtime.discovery":
        return this.handleRuntimeDiscovery(args);
      case "runtime.discoveryHealth":
        return this.handleRuntimeDiscoveryHealth();
      case "runtime.sandboxJobs":
        return this.handleSandboxJobs(args);
      case "runtime.flags":
        return this.handleRuntimeFlags();
      case "thread.inspect":
        return this.handleThreadInspect(args);
      case "thread.resume":
        return this.handleThreadResume(args);
      case "control.runDiscovery":
        return this.handleRunDiscovery(args);
      case "control.setNoSendsMode":
        return this.handleSetNoSendsMode(args);
      case "control.setCampaignTimezone":
        return this.handleSetCampaignTimezone(args);
      default:
        return this.handleCustomTool(name, args);
    }
  }

  protected async handleCustomTool(name: string, _args: Record<string, unknown>) {
    throw new Error(`unknown MCP tool ${name}`);
  }

  protected readLimit(value: unknown, fallback: number, max: number) {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(1, Math.min(Math.trunc(parsed), max));
  }

  protected readDiscoverySource(value: unknown): DefaultSdrMcpDiscoverySource {
    return value === "x_public_post" ? "x_public_post" : "linkedin_public_post";
  }

  protected durationMs(startedAt: number | null, completedAt: number | null) {
    if (startedAt === null) {
      return null;
    }
    const end = completedAt ?? Date.now();
    return Math.max(0, end - startedAt);
  }

  protected async getDiscoverySnapshots() {
    const campaign = await this.context.repository.ensureDefaultCampaign();
    const client = this.deps.getActorClient();

    const [linkedin, x] = await Promise.all([
      this.context.config.DISCOVERY_LINKEDIN_ENABLED
        ? client.discoveryCoordinator
            .getOrCreate([campaign.id, "linkedin_public_post"])
            .getSnapshot()
            .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }))
        : Promise.resolve(null),
      this.context.config.DISCOVERY_X_ENABLED
        ? client.discoveryCoordinator
            .getOrCreate([campaign.id, "x_public_post"])
            .getSnapshot()
            .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) }))
        : Promise.resolve(null),
    ]);

    return {
      campaign,
      snapshots: {
        linkedin_public_post: linkedin,
        x_public_post: x,
      },
    };
  }

  protected summarizeDiscoverySource(
    source: DefaultSdrMcpDiscoverySource,
    snapshot: Record<string, any> | null,
    enabled: boolean,
  ) {
    if (!enabled) {
      return {
        source,
        enabled: false,
        health: "disabled" as const,
        reason: `${source} discovery is disabled`,
      };
    }

    if (!snapshot) {
      return {
        source,
        enabled: true,
        health: "idle" as const,
        reason: "no actor snapshot available yet",
      };
    }

    if ("error" in snapshot) {
      return {
        source,
        enabled: true,
        health: "error" as const,
        reason: String(snapshot.error),
      };
    }

    const state = (snapshot.state ?? {}) as Record<string, unknown>;
    const runs = Array.isArray(snapshot.runs) ? snapshot.runs : [];
    const sourceState = ((snapshot.sourceState ?? null) as Record<string, unknown> | null) ?? null;
    const runningRuns = runs.filter((run) => run && (run as Record<string, unknown>).status === "running").length;
    const failedRuns = runs.filter((run) => {
      const status = String((run as Record<string, unknown>)?.status ?? "");
      return ["failed", "timed_out", "aborted"].includes(status);
    });
    const consecutiveEmptyRuns = Number(sourceState?.consecutive_empty_runs ?? 0);

    let health: "healthy" | "degraded" | "idle" | "error" = "healthy";
    let reason = "discovery is progressing normally";

    if (String(state.lastStatus ?? "") === "failed") {
      health = "error";
      reason = "last discovery tick failed";
    } else if (failedRuns.length > 0) {
      health = "degraded";
      reason = "recent discovery runs failed";
    } else if (consecutiveEmptyRuns >= 3) {
      health = "degraded";
      reason = `${consecutiveEmptyRuns} consecutive empty runs`;
    } else if (!Boolean(state.initialized)) {
      health = "idle";
      reason = "discovery actor is not initialized";
    } else if (runningRuns === 0 && Number(state.nextTickAt ?? 0) === 0) {
      health = "idle";
      reason = "no run in flight and no next tick scheduled";
    }

    return {
      source,
      enabled: true,
      health,
      reason,
      state: {
        status: state.lastStatus ?? null,
        initialized: Boolean(state.initialized),
        ticks: Number(state.ticks ?? 0),
        lastTickAt: Number(state.lastTickAt ?? 0) || null,
        nextTickAt: Number(state.nextTickAt ?? 0) || null,
        lastPlanner: state.lastPlanner ?? null,
        lastRunId: state.lastRunId ?? null,
        lastTerm: state.lastTerm ?? null,
      },
      metrics: {
        runningRuns,
        recentFailures: failedRuns.length,
        consecutiveEmptyRuns,
      },
      recentRuns: runs.slice(0, 5),
    };
  }

  protected summarizeThreadEvents(
    events: Array<{
      eventName: string;
      createdAt: string;
      payload: Record<string, unknown>;
    }>,
  ) {
    return events.map((event) => ({
      eventName: event.eventName,
      createdAt: event.createdAt,
      payload: event.payload,
    }));
  }

  private async handlePipelineSummary(args: Record<string, unknown>) {
    const limit = this.readLimit(args.limit, 5, 20);
    const [{ snapshots: discovery }, summary, activeThreads, qualifiedLeads, providerRuns, workflowFeed, recentProspects] =
      await Promise.all([
        this.getDiscoverySnapshots(),
        this.context.repository.getDashboardSummary(),
        this.context.repository.listActiveThreads(limit),
        this.context.repository.listQualifiedLeads(limit),
        this.context.repository.listRecentProviderRuns(limit),
        this.context.repository.listRecentAuditEvents(limit),
        this.context.repository.listRecentProspects(limit),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      headline: [
        `${summary.qualifiedLeads} qualified leads`,
        `${summary.activeThreads} active threads`,
        `${summary.pausedThreads} paused threads`,
        `${summary.providerRuns24h} provider runs in the last 24h`,
      ].join(", "),
      summary,
      discovery: {
        linkedin_public_post: discovery.linkedin_public_post,
        x_public_post: discovery.x_public_post,
      },
      activeThreads,
      qualifiedLeads,
      providerRuns,
      workflowFeed,
      recentProspects,
    };
  }

  private async handleRuntimeDiscovery(args: Record<string, unknown>) {
    const source = this.readDiscoverySource(args.source);
    const { snapshots } = await this.getDiscoverySnapshots();
    return snapshots[source];
  }

  private async handleRuntimeDiscoveryHealth() {
    const { snapshots } = await this.getDiscoverySnapshots();
    const linkedin = this.summarizeDiscoverySource(
      "linkedin_public_post",
      snapshots.linkedin_public_post as Record<string, any> | null,
      this.context.config.DISCOVERY_LINKEDIN_ENABLED,
    );
    const x = this.summarizeDiscoverySource(
      "x_public_post",
      snapshots.x_public_post as Record<string, any> | null,
      this.context.config.DISCOVERY_X_ENABLED,
    );

    const sources = [linkedin, x];
    const degradedSources = sources.filter((source) => source.health === "degraded" || source.health === "error");

    return {
      generatedAt: new Date().toISOString(),
      headline:
        degradedSources.length > 0
          ? `${degradedSources.length} discovery source${degradedSources.length === 1 ? "" : "s"} need attention`
          : "discovery sources are healthy",
      sources,
    };
  }

  private async handleSandboxJobs(args: Record<string, unknown>) {
    const client = this.deps.getActorClient();
    const jobs = await client.sandboxBroker.getOrCreate().listJobs({
      limit: this.readLimit(args.limit, 12, 100),
    });

    return jobs.map((job) => ({
      ...job,
      durationMs: this.durationMs(
        Number((job as Record<string, unknown>).startedAt ?? null) || null,
        Number((job as Record<string, unknown>).completedAt ?? null) || null,
      ),
    }));
  }

  private async handleRuntimeFlags() {
    const campaign = await this.context.repository.ensureDefaultCampaign();
    const client = this.deps.getActorClient();
    const [flags, campaignOps] = await Promise.all([
      this.context.repository.getControlFlags(),
      client.campaignOps
        .getOrCreate()
        .getSnapshot()
        .catch((error: unknown) => ({ error: error instanceof Error ? error.message : String(error) })),
    ]);

    return {
      campaign,
      flags,
      campaignOps,
    };
  }

  private async handleLeadInspect(args: Record<string, unknown>) {
    const prospectId = String(args.prospectId ?? "");
    if (!prospectId) {
      throw new Error("prospectId is required");
    }

    const eventLimit = this.readLimit(args.eventLimit, 8, 25);
    const snapshot = await this.context.repository.getProspectSnapshot(prospectId);
    const [prospect, signal, prospectEvents, threadEvents, outboundCount, latestInbound] = await Promise.all([
      this.context.repository.getProspectDashboardRow(prospectId),
      snapshot.prospect.sourceSignalId ? this.context.repository.getSignal(snapshot.prospect.sourceSignalId) : null,
      this.context.repository.listAuditEventsForEntity("prospect", prospectId, eventLimit),
      this.context.repository.listAuditEventsForEntity("thread", snapshot.thread.id, eventLimit),
      this.context.repository.countOutboundMessages(snapshot.thread.id),
      this.context.repository.getLatestInboundMessage(snapshot.thread.id),
    ]);

    const qualification = prospect?.qualification ?? null;
    const allEvents = [...prospectEvents, ...threadEvents]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, eventLimit);

    return {
      generatedAt: new Date().toISOString(),
      headline: `${snapshot.prospect.fullName} is ${snapshot.prospect.status} at stage ${snapshot.prospect.stage}`,
      prospect: snapshot.prospect,
      campaign: snapshot.campaign,
      thread: {
        ...snapshot.thread,
        outboundCount,
        latestInboundMessage: latestInbound
          ? {
              id: latestInbound.id,
              subject: latestInbound.subject,
              bodyText: latestInbound.body_text,
              createdAt: latestInbound.created_at ?? null,
            }
          : null,
      },
      qualification: qualification
        ? {
            decision: qualification.decision,
            summary: qualification.summary,
            reason: qualification.reason,
            confidence: qualification.confidence,
            matchedSegments: qualification.matchedSegments,
            matchedSignals: qualification.matchedSignals,
            disqualifiers: qualification.disqualifiers,
            missingEvidence: qualification.missingEvidence ?? [],
            checks: qualification.checks,
          }
        : null,
      research: snapshot.researchBrief
        ? {
            summary: snapshot.researchBrief.summary,
            confidence: snapshot.researchBrief.confidence,
            evidenceCount: snapshot.researchBrief.evidence.length,
            evidence: snapshot.researchBrief.evidence,
            createdAt: new Date(snapshot.researchBrief.createdAt).toISOString(),
          }
        : null,
      email: snapshot.email,
      sourceSignal: signal,
      recentEvents: this.summarizeThreadEvents(allEvents),
      messages: snapshot.messages,
    };
  }

  private async handleThreadInspect(args: Record<string, unknown>) {
    const threadId = String(args.threadId ?? "");
    if (!threadId) {
      throw new Error("threadId is required");
    }

    const thread = await this.context.repository.getThread(threadId);
    if (!thread) {
      throw new Error(`thread ${threadId} not found`);
    }

    const inspection = await this.handleLeadInspect({
      prospectId: String(thread.prospect_id),
      eventLimit: args.eventLimit,
    });

    return {
      ...inspection,
      threadId,
    };
  }

  private async handlePipelineFailures(args: Record<string, unknown>) {
    const providerLimit = this.readLimit(args.providerLimit, 25, 100);
    const prospectLimit = this.readLimit(args.prospectLimit, 50, 100);
    const sandboxLimit = this.readLimit(args.sandboxLimit, 25, 100);

    const [providerRuns, recentProspects, sandboxJobs, discoveryHealth] = await Promise.all([
      this.context.repository.listRecentProviderRuns(providerLimit),
      this.context.repository.listRecentProspects(prospectLimit),
      this.handleSandboxJobs({ limit: sandboxLimit }),
      this.handleRuntimeDiscoveryHealth(),
    ]);

    const providerFailures = providerRuns.filter((run) => ["failed", "timed_out", "aborted"].includes(run.status));
    const sandboxFailures = (sandboxJobs as Array<Record<string, unknown>>).filter((job) => job.status === "failed");
    const operationalBlocks = recentProspects
      .filter(
        (prospect) =>
          prospect.status === "paused"
          && typeof prospect.pausedReason === "string"
          && prospect.pausedReason.length > 0
          && prospect.pausedReason !== "no sends mode"
          && !prospect.pausedReason.startsWith("poor fit:")
          && !prospect.pausedReason.startsWith("handoff:"),
      )
      .map((prospect) => ({
        prospectId: prospect.id,
        fullName: prospect.fullName,
        company: prospect.company,
        stage: prospect.stage,
        pausedReason: prospect.pausedReason,
        updatedAt: prospect.updatedAt,
      }));

    const qualificationRejections = recentProspects
      .filter(
        (prospect) =>
          prospect.status === "paused"
          && typeof prospect.pausedReason === "string"
          && prospect.pausedReason.startsWith("poor fit:"),
      )
      .map((prospect) => ({
        prospectId: prospect.id,
        fullName: prospect.fullName,
        company: prospect.company,
        pausedReason: prospect.pausedReason,
        qualificationSummary: prospect.qualification?.summary ?? prospect.qualificationReason,
        updatedAt: prospect.updatedAt,
      }));

    const discoveryIssues = ((discoveryHealth as { sources?: Array<Record<string, unknown>> }).sources ?? []).filter(
      (source) => source.health === "degraded" || source.health === "error",
    );

    return {
      generatedAt: new Date().toISOString(),
      headline: [
        `${providerFailures.length} provider failures`,
        `${sandboxFailures.length} sandbox failures`,
        `${operationalBlocks.length} operational blocks`,
        `${qualificationRejections.length} qualification rejections`,
      ].join(", "),
      providerFailures,
      sandboxFailures,
      operationalBlocks,
      qualificationRejections,
      discoveryIssues,
    };
  }

  private async handleThreadResume(args: Record<string, unknown>) {
    const threadId = String(args.threadId ?? "");
    if (!threadId) {
      throw new Error("threadId is required");
    }

    const thread = await this.context.repository.getThread(threadId);
    if (!thread) {
      throw new Error(`thread ${threadId} not found`);
    }

    const snapshot = await this.context.repository.getProspectSnapshot(String(thread.prospect_id));
    const stage = typeof args.stage === "string" && args.stage.trim().length > 0
      ? args.stage.trim() as ProspectSnapshot["thread"]["stage"]
      : snapshot.thread.stage;
    const reason = typeof args.reason === "string" && args.reason.trim().length > 0
      ? args.reason.trim()
      : "manual resume";

    await this.context.repository.updateThreadState({
      threadId,
      stage,
      status: "active",
      pausedReason: null,
    });
    await this.context.repository.updateProspectState({
      prospectId: snapshot.prospect.prospectId,
      stage,
      status: "active",
      pausedReason: null,
    });
    await this.context.repository.appendAuditEvent("thread", threadId, "ThreadResumed", {
      reason,
      stage,
    });

    return {
      ok: true,
      threadId,
      prospectId: snapshot.prospect.prospectId,
      stage,
      reason,
    };
  }

  private async handleRunDiscovery(args: Record<string, unknown>) {
    const campaign = await this.context.repository.ensureDefaultCampaign();
    const source = this.readDiscoverySource(args.source);
    const result = await this.deps.getActorClient().discoveryCoordinator.getOrCreate([campaign.id, source]).enqueueTick({
      reason: typeof args.reason === "string" && args.reason.trim().length > 0 ? args.reason : "mcp_manual",
    });

    return {
      ...(result as Record<string, unknown>),
      campaignId: campaign.id,
      source,
    };
  }

  private async handleLeadUpdate(args: Record<string, unknown>) {
    const prospectId = String(args.prospectId);
    await this.context.repository.updateProspectState({
      prospectId,
      stage: args.stage as ProspectSnapshot["prospect"]["stage"] | undefined,
      status: args.status as ProspectSnapshot["prospect"]["status"] | undefined,
      lastReplyClass: (args.lastReplyClass as ProspectSnapshot["prospect"]["lastReplyClass"]) ?? undefined,
      pausedReason: (args.pausedReason as string | null) ?? undefined,
    });
    return { ok: true };
  }

  private async handleSetNoSendsMode(args: Record<string, unknown>) {
    return this.deps.getActorClient().campaignOps.getOrCreate().setNoSendsMode(Boolean(args.enabled));
  }

  private async handleSetCampaignTimezone(args: Record<string, unknown>) {
    const timezone = String(args.timezone ?? "").trim();
    if (!timezone) {
      throw new Error("timezone is required");
    }

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    } catch {
      throw new Error("invalid IANA timezone: " + timezone);
    }

    const campaignId = args.campaignId
      ? String(args.campaignId)
      : (await this.context.repository.ensureDefaultCampaign()).id;
    await this.context.repository.setCampaignTimezone(campaignId, timezone);
    const campaign = await this.context.repository.getCampaign(campaignId);
    await this.context.repository.appendAuditEvent("campaign", campaignId, "CampaignTimezoneUpdated", {
      timezone,
    });
    return {
      ok: true,
      campaign,
    };
  }
}
