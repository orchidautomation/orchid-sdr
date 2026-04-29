import type { HandoffWebhookPayload } from "../services/webhook-security.js";
import type { DiscoverySource } from "../domain/types.js";
import { getActorClient } from "../services/actor-client.js";
import type { WorkflowDependencies } from "./types.js";
import { ingestApifyRun, ingestSignalWebhook, type SignalWebhookPayload } from "./source-ingest.js";
import { processInboundReply } from "./prospect-workflow.js";

export interface ApifyWebhookPayload {
  eventType: string;
  actorRunId: string;
  source?: DiscoverySource;
  campaignId?: string;
  term?: string | null;
  defaultDatasetId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function handleApifyWebhook(
  deps: WorkflowDependencies,
  payload: ApifyWebhookPayload,
) {
  if (!payload.eventType.includes("SUCCEEDED")) {
    return {
      ok: true,
      ignored: true,
      reason: `unsupported event type ${payload.eventType}`,
    };
  }

  const campaignId = payload.campaignId ?? (await deps.context.repository.ensureDefaultCampaign()).id;
  const source = payload.source ?? "linkedin_public_post";
  const client = getActorClient();
  const actor = client.discoveryCoordinator.getOrCreate([campaignId, source]);

  return actor.handleApifyRunCompleted({
    actorRunId: payload.actorRunId,
    defaultDatasetId: payload.defaultDatasetId ?? null,
    source,
    campaignId,
    term: payload.term ?? null,
    metadata: payload.metadata ?? {},
  });
}

export async function handleAgentMailWebhook(
  deps: WorkflowDependencies,
  payload: {
    type: string;
    inboxId?: string | null;
    threadId?: string | null;
    messageId?: string | null;
    subject?: string | null;
    bodyText?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  if (payload.type !== "message.received") {
    return {
      ok: true,
      ignored: true,
      reason: `unsupported event type ${payload.type}`,
    };
  }

  if (!payload.threadId || !payload.bodyText) {
    return {
      ok: true,
      ignored: true,
      reason: "threadId or bodyText missing",
    };
  }

  return processInboundReply(deps, {
    providerInboxId: payload.inboxId ?? null,
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
