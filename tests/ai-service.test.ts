import { describe, expect, it } from "vitest";

import { AiStructuredService } from "../src/services/ai-service.js";

describe("AiStructuredService heuristics", () => {
  it("detects unsubscribe replies without a gateway key", async () => {
    const previous = process.env.AI_GATEWAY_API_KEY;
    const previousVercel = process.env.VERCEL_AI_GATEWAY_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_AI_GATEWAY_KEY;

    const service = new AiStructuredService();
    const result = await service.classifyReply("Please unsubscribe me from this list.");

    expect(result.classification).toBe("unsubscribe");

    if (previous) {
      process.env.AI_GATEWAY_API_KEY = previous;
    }
    if (previousVercel) {
      process.env.VERCEL_AI_GATEWAY_KEY = previousVercel;
    }
  });
});
