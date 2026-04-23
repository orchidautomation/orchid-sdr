import type { HandoffWebhookPayload } from "../services/webhook-security.js";
import type { DiscoverySource } from "../domain/types.js";
import type { WorkflowDependencies } from "./types.js";
import { ingestApifyRun, ingestSignalWebhook, type SignalWebhookPayload } from "./source-ingest.js";
import { processInboundReply } from "./prospect-workflow.js";

export async function handleApifyWebhook(
  deps: WorkflowDependencies,
  payload: {
    eventType: string;
    actorRunId: string;
    source?: DiscoverySource;
    campaignId?: string;
    term?: string | null;
    defaultDatasetId?: string | null;
  },
) {
  if (!payload.eventType.includes("SUCCEEDED")) {
    return {
      ok: true,
      ignored: true,
      reason: `unsupported event type ${payload.eventType}`,
    };
  }

  return ingestApifyRun(deps, {
    actorRunId: payload.actorRunId,
    source: payload.source,
    campaignId: payload.campaignId,
    term: payload.term ?? null,
    datasetId: payload.defaultDatasetId ?? null,
  });
}

export async function handleAgentMailWebhook(
  deps: WorkflowDependencies,
  payload: {
    type: string;
    threadId?: string | null;
    messageId?: string | null;
    subject?: string | null;
    bodyText?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  if (!payload.threadId || !payload.bodyText) {
    return {
      ok: true,
      ignored: true,
      reason: "threadId or bodyText missing",
    };
  }

  return processInboundReply(deps, {
    providerThreadId: payload.threadId,
    providerMessageId: payload.messageId ?? null,
    subject: payload.subject ?? null,
    bodyText: payload.bodyText,
    rawPayload: payload.payload ?? {},
  });
}

export async function handleSignalWebhook(
  deps: WorkflowDependencies,
  payload: SignalWebhookPayload,
) {
  return ingestSignalWebhook(deps, payload);
}

export async function handleHandoffWebhook(
  deps: WorkflowDependencies,
  payload: HandoffWebhookPayload,
) {
  await deps.context.repository.appendAuditEvent("thread", payload.threadId, "HandoffRequested", {
    disposition: payload.disposition,
    notes: payload.notes ?? null,
    actor: payload.actor ?? null,
  });

  return {
    ok: true,
  };
}
