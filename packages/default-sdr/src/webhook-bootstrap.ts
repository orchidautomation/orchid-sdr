import type { Hono } from "hono";

export type DefaultSdrDiscoverySource = "linkedin_public_post" | "x_public_post";

export interface DefaultSdrWebhookContext {
  config: {
    APIFY_WEBHOOK_SECRET: string;
    SIGNAL_WEBHOOK_SECRET?: string | null;
  };
  repository: {
    ensureDefaultCampaign(): Promise<{ id: string }>;
  };
  security: {
    verifySharedSecretHeader(provided: string | null, expected: string | null | undefined): boolean;
    verifyAgentMailWebhook(
      rawBody: string,
      headers: {
        "svix-id": string | null | undefined;
        "svix-timestamp": string | null | undefined;
        "svix-signature": string | null | undefined;
      },
    ): boolean;
    verifyHandoffSignature(rawBody: string, signature: string | null): boolean;
  };
  providers: {
    email?: {
      isConfigured(): boolean;
      getMessage(inboxId: string, messageId: string): Promise<{ bodyText: string | null } | null>;
    } | null;
  };
}

export interface DefaultSdrWebhookHandlers {
  onApifyRunCompleted(input: {
    actorRunId: string;
    defaultDatasetId: string | null;
    source: DefaultSdrDiscoverySource;
    campaignId: string;
    term: string | null;
    metadata: Record<string, unknown>;
  }): Promise<unknown>;
  onSignal(input: {
    provider: string;
    source: string;
    campaignId?: string;
    externalId?: string | null;
    term?: string | null;
    metadata: Record<string, unknown>;
    signal?: Record<string, unknown>;
    signals?: Array<Record<string, unknown>>;
  }): Promise<unknown>;
  onAgentMail(input: {
    type: string;
    inboxId?: string | null;
    threadId?: string | null;
    messageId?: string | null;
    subject?: string | null;
    bodyText?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<unknown>;
  onHandoff(input: {
    threadId: string;
    disposition: string;
    notes?: string;
    actor?: string;
  }): Promise<unknown>;
}

export function readString(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function mountDefaultSdrWebhookRoutes(
  app: Hono,
  input: {
    context: DefaultSdrWebhookContext;
    handlers: DefaultSdrWebhookHandlers;
  },
) {
  const { context, handlers } = input;

  app.post("/webhooks/apify", async (c) => {
    const rawBody = await c.req.text();
    const expected = context.config.APIFY_WEBHOOK_SECRET;
    const provided = c.req.header("x-trellis-webhook-secret") ?? c.req.query("secret");
    if (!context.security.verifySharedSecretHeader(provided ?? null, expected)) {
      return c.json({ error: "invalid secret" }, 401);
    }

    const json = JSON.parse(rawBody) as {
      eventType: string;
      source?: string;
      term?: string;
      campaignId?: string;
      metadata?: Record<string, unknown>;
      resource?: {
        actorRunId?: string;
        id?: string;
        defaultDatasetId?: string;
      };
    };

    if (!json.eventType.includes("SUCCEEDED")) {
      return c.json({
        ok: true,
        ignored: true,
        reason: `unsupported event type ${json.eventType}`,
      });
    }

    const source: DefaultSdrDiscoverySource =
      json.source === "x_public_post" || json.source === "linkedin_public_post"
        ? json.source
        : "linkedin_public_post";
    const actorRunId = json.resource?.actorRunId ?? json.resource?.id ?? "";
    if (!actorRunId) {
      return c.json({ error: "missing actorRunId" }, 400);
    }
    const campaignId = json.campaignId ?? (await context.repository.ensureDefaultCampaign()).id;
    const result = await handlers.onApifyRunCompleted({
      actorRunId,
      defaultDatasetId: json.resource?.defaultDatasetId ?? null,
      source,
      campaignId,
      term: json.term ?? null,
      metadata: json.metadata ?? {},
    });

    return c.json(result);
  });

  app.post("/webhooks/signals", async (c) => {
    const rawBody = await c.req.text();
    const expected = context.config.SIGNAL_WEBHOOK_SECRET ?? context.config.APIFY_WEBHOOK_SECRET;
    const provided = c.req.header("x-trellis-webhook-secret") ?? c.req.query("secret");
    if (!context.security.verifySharedSecretHeader(provided ?? null, expected)) {
      return c.json({ error: "invalid secret" }, 401);
    }

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const result = await handlers.onSignal({
      provider: readString(json, ["provider"]) ?? "webhook",
      source: readString(json, ["source"]) ?? "other",
      campaignId: readString(json, ["campaignId", "campaign_id"]) ?? undefined,
      externalId: readString(json, ["externalId", "external_id", "runId", "run_id"]) ?? null,
      term: readString(json, ["term", "query", "keyword"]) ?? null,
      metadata: json.metadata && typeof json.metadata === "object" && !Array.isArray(json.metadata)
        ? (json.metadata as Record<string, unknown>)
        : {},
      signal: json.signal && typeof json.signal === "object" && !Array.isArray(json.signal)
        ? (json.signal as Record<string, unknown>)
        : undefined,
      signals: Array.isArray(json.signals)
        ? json.signals.filter(
            (value): value is Record<string, unknown> =>
              Boolean(value && typeof value === "object" && !Array.isArray(value)),
          )
        : undefined,
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
    if (!context.security.verifyAgentMailWebhook(rawBody, headers)) {
      return c.json({ error: "invalid signature" }, 401);
    }

    const json = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = readString(json, ["event_type", "type"]) ?? "";
    const message = (json.message && typeof json.message === "object" ? json.message : {}) as Record<string, unknown>;
    const thread = (json.thread && typeof json.thread === "object" ? json.thread : {}) as Record<string, unknown>;
    const payload = (json.payload && typeof json.payload === "object" ? json.payload : {}) as Record<string, unknown>;
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

    if (!bodyText && inboxId && messageId && context.providers.email?.isConfigured()) {
      const fullMessage = await context.providers.email.getMessage(inboxId, messageId).catch(() => null);
      bodyText = fullMessage?.bodyText ?? null;
    }

    const result = await handlers.onAgentMail({
      type: eventType,
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
    const signature = c.req.header("x-trellis-signature");
    if (!context.security.verifyHandoffSignature(rawBody, signature ?? null)) {
      return c.json({ error: "invalid signature" }, 401);
    }

    const json = JSON.parse(rawBody) as {
      threadId: string;
      disposition: string;
      notes?: string;
      actor?: string;
    };

    const result = await handlers.onHandoff(json);
    return c.json(result);
  });
}
