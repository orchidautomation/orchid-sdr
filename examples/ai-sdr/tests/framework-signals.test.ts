import { describe, expect, it } from "vitest";

import {
  normalizeSignalWebhookPayload,
  normalizedSignalSchema,
  signalWebhookPayloadSchema,
} from "@ai-sdr/framework/signals";

describe("framework signal contracts", () => {
  it("normalizes webhook signals with stable source refs and timestamps", () => {
    const result = normalizeSignalWebhookPayload({
      provider: "hubspot",
      source: "warm_form",
      campaignId: "cmp_test",
      signal: {
        url: "https://example.com/demo",
        authorName: "Avery Stone",
        authorTitle: "Head of Growth",
        authorCompany: "Northstar",
        companyDomain: "northstar.ai",
        topic: "demo request",
        content: "We want to automate account research.",
        capturedAt: "2026-04-25T12:00:00.000Z",
      },
    });

    expect(result.provider).toBe("hubspot");
    expect(result.source).toBe("warm_form");
    expect(result.campaignId).toBe("cmp_test");
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.signal.sourceRef).toBeTruthy();
    expect(result.signals[0]?.signal.capturedAt).toBe(Date.parse("2026-04-25T12:00:00.000Z"));
  });

  it("exposes zod schemas for coding agents and adapters", () => {
    expect(() =>
      normalizedSignalSchema.parse({
        sourceRef: "sig_1",
        url: "https://example.com",
        authorName: "Jordan",
        authorTitle: null,
        authorCompany: null,
        companyDomain: null,
        topic: "GTM",
        content: "",
        metadata: {},
        capturedAt: Date.now(),
      }),
    ).not.toThrow();

    expect(signalWebhookPayloadSchema.parse({ provider: "manual", signals: [] })).toEqual({
      provider: "manual",
      signals: [],
    });
  });
});
