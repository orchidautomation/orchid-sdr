import crypto from "node:crypto";

import { Webhook } from "svix";
import { describe, expect, it } from "vitest";

import {
  verifyAgentMailWebhook,
  verifyHandoffSignature,
} from "../src/services/webhook-security.js";

describe("webhook security", () => {
  it("verifies handoff signatures", () => {
    const body = JSON.stringify({ threadId: "thr_1", disposition: "positive" });
    const signature = crypto
      .createHmac("sha256", process.env.HANDOFF_WEBHOOK_SECRET ?? "handoff-secret")
      .update(body)
      .digest("hex");

    expect(verifyHandoffSignature(body, signature)).toBe(true);
    expect(verifyHandoffSignature(body, "wrong")).toBe(false);
  });

  it("verifies AgentMail-style Svix signatures", () => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET ?? "whsec_test_secret_value";

    const body = JSON.stringify({ type: "message.received", threadId: "provider-thread" });
    const svixId = "msg_123";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const webhook = new Webhook(secret);
    const signature = webhook.sign(svixId, new Date(Number(svixTimestamp) * 1000), body);

    expect(
      verifyAgentMailWebhook(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": signature,
      }),
    ).toBe(true);
  });
});
