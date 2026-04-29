import type { Hono } from "hono";

import type { DiscoverySource } from "../domain/types.js";
import {
  handleAgentMailWebhook,
  handleApifyWebhook,
  handleHandoffWebhook,
  handleSignalWebhook,
} from "../orchestration/webhook-handlers.js";
import type { WorkflowDependencies } from "../orchestration/types.js";

export function registerWebhookRoutes(app: Hono, deps: WorkflowDependencies) {
  app.post("/webhooks/apify", async (c) => {
    const rawBody = await c.req.text();
    const expected = deps.context.config.APIFY_WEBHOOK_SECRET;
    const provided = c.req.header("x-orchid-webhook-secret") ?? c.req.query("secret");
    if (!deps.context.security.verifySharedSecretHeader(provided ?? null, expected)) {
      return c.json({ error: "invalid secret" }, 401);
    }

    const json = JSON.parse(rawBody) as Record<string, unknown>;
    const resource = readRecord(json, ["resource"]);
    const actorRunId = readString(resource ?? undefined, ["actorRunId", "id"]);
    if (!actorRunId) {
      return c.json({ error: "missing actorRunId" }, 400);
    }

    const result = await handleApifyWebhook(deps, {
      eventType: readString(json, ["eventType"]) ?? "",
      actorRunId,
      defaultDatasetId: readString(resource ?? undefined, ["defaultDatasetId"]),
      source: readDiscoverySource(readString(json, ["source"])),
      campaignId: readString(json, ["campaignId"]) ?? undefined,
      term: readString(json, ["term"]),
      metadata: readRecord(json, ["metadata"]) ?? {},
    });
    return c.json(result);
  });

  app.post("/webhooks/signals", async (c) => {
    const rawBody = await c.req.text();
    const expected = deps.context.config.SIGNAL_WEBHOOK_SECRET ?? deps.context.config.APIFY_WEBHOOK_SECRET;
    const provided = c.req.header("x-orchid-webhook-secret") ?? c.req.query("secret");
    if (!deps.context.security.verifySharedSecretHeader(provided ?? null, expected)) {
      return c.json({ error: "invalid secret" }, 401);
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const result = await handleSignalWebhook(deps, {
      provider: readString(json, ["provider"]) ?? "webhook",
      source: readString(json, ["source"]) ?? "other",
      campaignId: readString(json, ["campaignId", "campaign_id"]) ?? undefined,
      externalId: readString(json, ["externalId", "external_id", "runId", "run_id"]) ?? null,
      term: readString(json, ["term", "query", "keyword"]) ?? null,
      metadata: readRecord(json, ["metadata"]) ?? {},
      signal: readRecord(json, ["signal"]) ?? undefined,
      signals: readRecordArray(json, ["signals"]) ?? undefined,
    });

    return c.json(result);
  });

  app.post("/webhooks/agentmail", async (c) => {
    const rawBody = await c.req.text();
    const headers = {
      "svix-id": c.req.header("svix-id"),
      "svix-timestamp": c.req.header("svix-timestamp"),
      "svix-signature": c.req.header("svix-signature"),
    };
    if (!deps.context.security.verifyAgentMailWebhook(rawBody, headers)) {
      return c.json({ error: "invalid signature" }, 401);
    }

    const json = JSON.parse(rawBody) as Record<string, unknown>;
    const message = readRecord(json, ["message"]) ?? {};
    const thread = readRecord(json, ["thread"]) ?? {};
    const payload = readRecord(json, ["payload"]) ?? {};
    const inboxId =
      readString(message, ["inbox_id", "inboxId"])
      ?? readString(thread, ["inbox_id", "inboxId"])
      ?? readString(payload, ["inboxId", "inbox_id"]);
    const threadId =
      readString(message, ["thread_id", "threadId"])
      ?? readString(thread, ["thread_id", "threadId"])
      ?? readString(json, ["threadId", "thread_id"])
      ?? readString(payload, ["threadId", "thread_id"]);
    const messageId =
      readString(message, ["message_id", "messageId"])
      ?? readString(json, ["messageId", "message_id"])
      ?? readString(payload, ["messageId", "message_id"]);
    let bodyText =
      readString(message, ["text", "extracted_text", "preview"])
      ?? readString(json, ["bodyText", "body_text", "text"])
      ?? readString(payload, ["bodyText", "body_text", "text"]);

    if (!bodyText && inboxId && messageId && deps.context.agentMail.isConfigured()) {
      const fullMessage = await deps.context.agentMail.getMessage(inboxId, messageId).catch(() => null);
      bodyText = fullMessage?.bodyText ?? null;
    }

    const result = await handleAgentMailWebhook(deps, {
      type: readString(json, ["event_type", "type"]) ?? "",
      inboxId,
      threadId,
      messageId,
      subject:
        readString(message, ["subject"])
        ?? readString(thread, ["subject"])
        ?? readString(json, ["subject"])
        ?? readString(payload, ["subject"]),
      bodyText,
      payload: json,
    });

    return c.json(result ?? { ok: true, ignored: true });
  });

  app.post("/webhooks/handoff", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-orchid-signature");
    if (!deps.context.security.verifyHandoffSignature(rawBody, signature ?? null)) {
      return c.json({ error: "invalid signature" }, 401);
    }

    const result = await handleHandoffWebhook(deps, JSON.parse(rawBody) as {
      threadId: string;
      disposition: string;
      notes?: string;
      actor?: string;
    });
    return c.json(result);
  });
}

function readString(input: Record<string, unknown> | undefined, keys: string[]) {
  if (!input) {
    return null;
  }

  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readRecord(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function readRecordArray(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (!Array.isArray(value)) {
      continue;
    }

    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)));
  }

  return null;
}

function readDiscoverySource(value: string | null): DiscoverySource | undefined {
  if (value === "linkedin_public_post" || value === "x_public_post") {
    return value;
  }

  return undefined;
}
