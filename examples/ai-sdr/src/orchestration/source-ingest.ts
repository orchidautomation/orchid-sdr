import { createId } from "../lib/ids.js";
import type { DiscoverySource, SignalSource } from "../domain/types.js";
import {
  normalizeSignalWebhookPayload,
  type NormalizedSignal,
  type SignalWebhookPayload as FrameworkSignalWebhookPayload,
} from "@ai-sdr/framework/signals";
import type { WorkflowDependencies } from "./types.js";
import { executeProspectWorkflow } from "./prospect-workflow.js";

export type NormalizedInboundSignal = NormalizedSignal;
export type SignalWebhookPayload = FrameworkSignalWebhookPayload;
export { normalizeSignalWebhookPayload };

async function ingestNormalizedSignals(
  deps: WorkflowDependencies,
  input: {
    provider: string;
    kind: string;
    source: SignalSource;
    externalId?: string | null;
    campaignId?: string;
    term?: string | null;
    requestPayload?: Record<string, unknown>;
    signals: NormalizedInboundSignal[];
  },
) {
  const runtimeProviderId = deps.context.framework?.selections.runtimeActor.providerId ?? "rivet";
  const campaign = input.campaignId
    ? await deps.context.repository.getCampaign(input.campaignId)
    : await deps.context.repository.ensureDefaultCampaign();
  const providerRunId = await deps.context.repository.recordProviderRun({
    provider: input.provider,
    kind: input.kind,
    externalId: input.externalId ?? null,
    status: "running",
    requestPayload: input.requestPayload ?? {},
  });

  try {
    await deps.context.state.recordWorkflowCheckpoint({
      workflowName: "signal-ingest",
        entityType: "providerRun",
        entityId: providerRunId,
        step: "started",
        status: "running",
        runtimeProvider: runtimeProviderId,
        input: {
          provider: input.provider,
        kind: input.kind,
        source: input.source,
        campaignId: campaign.id,
        signalCount: input.signals.length,
      },
    });

    const outcomes = [];

    for (const inbound of input.signals) {
      const signalId = await deps.context.repository.insertSignal({
        id: createId("sig"),
        campaignId: campaign.id,
        source: input.source,
        sourceRef: inbound.sourceRef,
        actorRunId: input.externalId ?? null,
        datasetId: null,
        url: inbound.url,
        authorName: inbound.authorName,
        authorTitle: inbound.authorTitle,
        authorCompany: inbound.authorCompany,
        companyDomain: inbound.companyDomain,
        topic: inbound.topic,
        content: inbound.content,
        capturedAt: inbound.capturedAt,
        metadata: inbound.metadata,
      });
      const stateSignal = await deps.context.state.recordSignal({
        campaignId: campaign.id,
        provider: input.provider,
        source: input.source,
        externalId: input.externalId ?? null,
        localSignalId: signalId,
        signal: inbound,
        metadata: {
          source: input.source,
          provider: input.provider,
          discoveryTerm: input.term ?? null,
        },
      });
      await deps.context.state.recordWorkflowCheckpoint({
        workflowName: "signal-ingest",
        entityType: "signal",
        entityId: signalId,
        step: "captured",
        status: "succeeded",
        runtimeProvider: runtimeProviderId,
        output: {
          stateProviderId: stateSignal.providerId,
          stateSignalId: stateSignal.stateSignalId,
          stateStored: stateSignal.stored,
        },
      });
      await deps.context.repository.appendAuditEvent("signal", signalId, "SignalCaptured", {
        source: input.source,
        provider: input.provider,
        externalId: input.externalId ?? null,
        discoveryTerm: input.term ?? null,
      });
      await deps.context.state.appendAuditEvent({
        entityType: "signal",
        entityId: signalId,
        eventName: "SignalCaptured",
        payload: {
          source: input.source,
          provider: input.provider,
          externalId: input.externalId ?? null,
          discoveryTerm: input.term ?? null,
        },
      });

      const { prospectId } = await deps.context.repository.createOrUpdateProspectFromSignal(signalId, campaign.id);
      const outcome = await executeProspectWorkflow(deps, prospectId);
      await deps.context.state.recordWorkflowCheckpoint({
        workflowName: "prospect-workflow",
        entityType: "prospect",
        entityId: prospectId,
        step: outcome.action,
        status: "succeeded",
        runtimeProvider: runtimeProviderId,
        output: compactRecord({
          prospectId: outcome.prospectId,
          threadId: outcome.threadId,
          reason: outcome.reason,
          followupDelayMs: outcome.followupDelayMs,
        }),
      });
      outcomes.push(outcome);
    }

    await deps.context.repository.updateProviderRun(providerRunId, {
      status: "succeeded",
      responsePayload: {
        itemsSeen: input.signals.length,
        signalsReceived: input.signals.length,
        prospectsProcessed: outcomes.length,
      },
    });
    await deps.context.state.recordWorkflowCheckpoint({
      workflowName: "signal-ingest",
      entityType: "providerRun",
      entityId: providerRunId,
      step: "completed",
      status: "succeeded",
      runtimeProvider: runtimeProviderId,
      output: {
        signalsReceived: input.signals.length,
        prospectsProcessed: outcomes.length,
      },
    });

    return {
      ok: true,
      itemsSeen: input.signals.length,
      signalsReceived: input.signals.length,
      prospectsProcessed: outcomes.length,
      outcomes,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await deps.context.repository.updateProviderRun(providerRunId, {
      status: "failed",
      responsePayload: {
        error: errorMessage,
      },
    });
    try {
      await deps.context.state.recordWorkflowCheckpoint({
        workflowName: "signal-ingest",
        entityType: "providerRun",
        entityId: providerRunId,
        step: "failed",
        status: "failed",
        runtimeProvider: runtimeProviderId,
        error: errorMessage,
      });
    } catch {
      // Preserve the original workflow error if the state-plane failure checkpoint also fails.
    }
    throw error;
  }
}

export async function ingestApifyRun(
  deps: WorkflowDependencies,
  input: {
    actorRunId: string;
    source?: DiscoverySource;
    campaignId?: string;
    term?: string | null;
    datasetId?: string | null;
  },
) {
  const source = input.source ?? "linkedin_public_post";
  const discoveryProvider = deps.context.providers.discovery;
  if (!discoveryProvider) {
    throw new Error("discovery provider is not configured");
  }
  const rawItems = input.datasetId
    ? await discoveryProvider.fetchDatasetItems(input.datasetId, source)
    : [];
  const normalized = discoveryProvider.normalizeSignals(source, rawItems) as Array<{
    sourceRef: string;
    url: string;
    authorName: string;
    authorTitle?: string | null;
    authorCompany?: string | null;
    companyDomain?: string | null;
    topic: string;
    content: string;
    metadata: Record<string, unknown>;
    capturedAt?: number;
  }>;

  return ingestNormalizedSignals(deps, {
    provider: discoveryProvider.providerId,
    kind: `${source}-source`,
    source,
    externalId: input.actorRunId,
    campaignId: input.campaignId,
    term: input.term ?? null,
    requestPayload: input,
    signals: normalized.map((signal) => ({
      sourceRef: signal.sourceRef,
      url: signal.url,
      authorName: signal.authorName,
      authorTitle: signal.authorTitle ?? null,
      authorCompany: signal.authorCompany ?? null,
      companyDomain: signal.companyDomain ?? null,
      topic: signal.topic,
      content: signal.content,
      metadata: signal.metadata,
      capturedAt: Date.now(),
    })),
  });
}

export async function ingestSignalWebhook(
  deps: WorkflowDependencies,
  payload: SignalWebhookPayload,
) {
  const normalized = normalizeSignalWebhookPayload(payload);
  if (normalized.signals.length === 0) {
    return {
      ok: true,
      ignored: true,
      reason: "no valid signals provided",
    };
  }

  const grouped = normalized.signals.reduce<Record<string, NormalizedInboundSignal[]>>((acc, item) => {
    const bucket = acc[item.source] ?? [];
    bucket.push(item.signal);
    acc[item.source] = bucket;
    return acc;
  }, {});

  const results = [];
  for (const [source, signals] of Object.entries(grouped)) {
    results.push(await ingestNormalizedSignals(deps, {
      provider: normalized.provider,
      kind: `${normalized.provider}:${source}`,
      source,
      externalId: normalized.externalId,
      campaignId: normalized.campaignId,
      term: normalized.term,
      requestPayload: payload as Record<string, unknown>,
      signals,
    }));
  }

  return {
    ok: true,
    batches: results.length,
    signalsReceived: normalized.signals.length,
    results,
  };
}

function compactRecord(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
