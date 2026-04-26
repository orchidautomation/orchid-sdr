import { createHash } from "node:crypto";

import { z } from "zod";

export const normalizedSignalSchema = z.object({
  sourceRef: z.string().min(1),
  url: z.string().min(1),
  authorName: z.string().min(1),
  authorTitle: z.string().nullable(),
  authorCompany: z.string().nullable(),
  companyDomain: z.string().nullable(),
  topic: z.string().min(1),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  capturedAt: z.number().finite(),
});

export const providerSignalSchema = normalizedSignalSchema.extend({
  capturedAt: z.number().finite().optional(),
});

export const signalWebhookPayloadSchema = z.object({
  provider: z.string().optional(),
  source: z.string().optional(),
  campaignId: z.string().optional(),
  externalId: z.string().nullable().optional(),
  term: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  signal: z.record(z.string(), z.unknown()).optional(),
  signals: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type NormalizedSignal = z.infer<typeof normalizedSignalSchema>;
export type ProviderSignal = z.infer<typeof providerSignalSchema>;
export type SignalWebhookPayload = z.infer<typeof signalWebhookPayloadSchema>;

export interface NormalizedSignalBatch {
  provider: string;
  source: string;
  campaignId?: string;
  externalId: string | null;
  term: string | null;
  metadata: Record<string, unknown>;
  signals: Array<{
    source: string;
    signal: NormalizedSignal;
  }>;
}

export function normalizeSignalWebhookPayload(payload: SignalWebhookPayload | unknown): NormalizedSignalBatch {
  const parsed = signalWebhookPayloadSchema.parse(payload);
  const provider = parsed.provider?.trim() || "normalized-webhook";
  const defaultSource = parsed.source?.trim() || "other";
  const rawSignals = Array.isArray(parsed.signals)
    ? parsed.signals
    : parsed.signal
      ? [parsed.signal]
      : [];

  const signals = rawSignals.reduce<NormalizedSignalBatch["signals"]>((acc, rawSignal) => {
    const normalized = normalizeSignalWebhookRecord(defaultSource, rawSignal);
    if (normalized) {
      acc.push(normalized);
    }
    return acc;
  }, []);

  return {
    provider,
    source: defaultSource,
    campaignId: parsed.campaignId,
    externalId: parsed.externalId ?? null,
    term: parsed.term ?? null,
    metadata: parsed.metadata ?? {},
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
    source,
    signal: normalizedSignalSchema.parse({
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
    }),
  };
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
