import crypto from "node:crypto";

import { Webhook } from "svix";

import { getConfig } from "../config.js";

export interface HandoffWebhookPayload {
  threadId: string;
  disposition: string;
  notes?: string;
  actor?: string;
}

export function verifySharedSecretHeader(headerValue: string | null, expected: string | undefined) {
  if (!expected) {
    return true;
  }

  return headerValue === expected;
}

export function verifyHandoffSignature(body: string, signature: string | null) {
  const config = getConfig();
  const expected = crypto.createHmac("sha256", config.HANDOFF_WEBHOOK_SECRET).update(body).digest("hex");
  return signature === expected;
}

export function verifyAgentMailWebhook(body: string, headers: Record<string, string | undefined>) {
  const config = getConfig();
  if (!config.AGENTMAIL_WEBHOOK_SECRET) {
    return true;
  }

  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signatureHeader = headers["svix-signature"];

  if (!id || !timestamp || !signatureHeader) {
    return false;
  }

  try {
    const webhook = new Webhook(config.AGENTMAIL_WEBHOOK_SECRET);
    webhook.verify(body, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signatureHeader,
    });
    return true;
  } catch {
    return false;
  }
}
