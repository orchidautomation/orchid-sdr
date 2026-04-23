import { createHash } from "node:crypto";

import { createId } from "../lib/ids.js";
import type { DiscoverySource, SignalSource } from "../domain/types.js";
import type { WorkflowDependencies } from "./types.js";
import { executeProspectWorkflow } from "./prospect-workflow.js";

export interface NormalizedInboundSignal {
  sourceRef: string;
  url: string;
  authorName: string;
  authorTitle: string | null;
  authorCompany: string | null;
  companyDomain: string | null;
  topic: string;
  content: string;
  metadata: Record<string, unknown>;
  capturedAt: number;
}

export interface SignalWebhookPayload {
  provider?: string;
  source?: string;
  campaignId?: string;
  externalId?: string | null;
  term?: string | null;
  metadata?: Record<string, unknown>;
  signal?: Record<string, unknown>;
  signals?: Record<string, unknown>[];
}

function readString(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readObject(input: Record<string, unknown>, key: string) {
  const value = input[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readCapturedAt(input: Record<string, unknown>) {
  const candidate = input.capturedAt ?? input.captured_at ?? input.timestamp ?? input.publishedAt;
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate > 10_000_000_000 ? candidate : candidate * 1000;
  }
  if (typeof candidate === "string") {
    const asNumber = Number(candidate);
    if (Number.isFinite(asNumber)) {
      return asNumber > 10_000_000_000 ? asNumber : asNumber * 1000;
    }
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function deriveSourceRef(source: string, input: Record<string, unknown>, url: string, content: string) {
  return readString(input, ["sourceRef", "source_ref", "id", "externalId", "external_id"])
    ?? createHash("sha256").update([source, url, content].join("|")).digest("hex").slice(0, 24);
}

export function normalizeSignalWebhookPayload(payload: SignalWebhookPayload) {
  const provider = payload.provider?.trim() || "webhook";
  const defaultSource = payload.source?.trim() || "other";
  const rawSignals = Array.isArray(payload.signals)
    ? payload.signals
    : payload.signal && typeof payload.signal === "object"
      ? [payload.signal]
      : [];

  const signals = rawSignals.reduce<Array<{ source: SignalSource; signal: NormalizedInboundSignal }>>((acc, rawSignal) => {
    const normalized = normalizeSignalWebhookRecord(defaultSource, rawSignal);
    if (normalized) {
      acc.push(normalized);
    }
    return acc;
  }, []);

  return {
    provider,
    source: defaultSource as SignalSource,
    campaignId: payload.campaignId,
    externalId: payload.externalId ?? null,
    term: payload.term ?? null,
    metadata: payload.metadata ?? {},
    signals,
  };
}

function normalizeSignalWebhookRecord(defaultSource: string, rawSignal: Record<string, unknown>) {
  const source = readString(rawSignal, ["source"]) ?? defaultSource;
  const metadata = readObject(rawSignal, "metadata") ?? {};
  const url = readString(rawSignal, ["url", "postUrl", "sourceUrl", "link"]);
  if (!url) {
    return null;
  }

  const content =
    readString(rawSignal, ["content", "text", "body", "description", "excerpt"])
    ?? "";
  const topic =
    readString(rawSignal, ["topic", "title", "query", "keyword"])
    ?? source
    ?? "other";

  return {
    source: source as SignalSource,
    signal: {
      sourceRef: deriveSourceRef(source, rawSignal, url, content),
      url,
      authorName: readString(rawSignal, ["authorName", "name", "author", "fullName"]) ?? "Unknown",
      authorTitle: readString(rawSignal, ["authorTitle", "title", "headline", "role"]),
      authorCompany: readString(rawSignal, ["authorCompany", "company", "companyName"]),
      companyDomain: readString(rawSignal, ["companyDomain", "domain", "website"]),
      topic,
      content,
      metadata: {
        ...metadata,
        raw: rawSignal,
      },
      capturedAt: readCapturedAt(rawSignal),
    },
  };
}

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
