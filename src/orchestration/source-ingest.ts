import { createId } from "../lib/ids.js";
import type { DiscoverySource, SignalSource } from "../domain/types.js";
import {
  normalizeSignalWebhookPayload,
  type NormalizedSignal,
  type SignalWebhookPayload as FrameworkSignalWebhookPayload,
} from "../framework/signals.js";
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
      await deps.context.repository.appendAuditEvent("signal", signalId, "SignalCaptured", {
        source: input.source,
        provider: input.provider,
        externalId: input.externalId ?? null,
        discoveryTerm: input.term ?? null,
      });

      const { prospectId } = await deps.context.repository.createOrUpdateProspectFromSignal(signalId, campaign.id);
      outcomes.push(await executeProspectWorkflow(deps, prospectId));
    }

    await deps.context.repository.updateProviderRun(providerRunId, {
      status: "succeeded",
      responsePayload: {
        itemsSeen: input.signals.length,
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
    await deps.context.repository.updateProviderRun(providerRunId, {
      status: "failed",
      responsePayload: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
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
  const rawItems = input.datasetId
    ? await deps.context.apify.fetchDatasetItems(input.datasetId, source)
    : [];
  const normalized = deps.context.apify.normalizeSignals(source, rawItems);

  return ingestNormalizedSignals(deps, {
    provider: "apify",
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
