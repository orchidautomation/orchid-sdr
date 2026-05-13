import { describe, expect, it } from "vitest";

import {
  DEFAULT_GATEWAY_MODEL,
  resolveDefaultModel,
  resolveSandboxStageModel,
  resolveStructuredModel,
} from "../src/services/model-routing.js";

describe("model routing", () => {
  it("falls back to the global default model when no routing is configured", () => {
    expect(resolveDefaultModel(undefined)).toBe(DEFAULT_GATEWAY_MODEL);
    expect(resolveSandboxStageModel(undefined, "build_research_brief")).toBe(DEFAULT_GATEWAY_MODEL);
    expect(resolveStructuredModel(undefined, "policyCheck")).toBe(DEFAULT_GATEWAY_MODEL);
  });

  it("prefers stage-specific sandbox model overrides", () => {
    const config = {
      name: "test",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      modelRouting: {
        defaultModel: "openai/gpt-5-mini",
        sandbox: {
          defaultModel: "anthropic/claude-sonnet-4",
          stages: {
            build_research_brief: "openai/gpt-5",
          },
        },
      },
    } as const;

    expect(resolveSandboxStageModel(config, "build_research_brief")).toBe("openai/gpt-5");
    expect(resolveSandboxStageModel(config, "qualify")).toBe("anthropic/claude-sonnet-4");
  });

  it("prefers structured-operation overrides over the global default", () => {
    const config = {
      name: "test",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      modelRouting: {
        defaultModel: "moonshotai/kimi-k2.6",
        structured: {
          qualifyProspect: "openai/gpt-5",
        },
      },
    } as const;

    expect(resolveStructuredModel(config, "qualifyProspect")).toBe("openai/gpt-5");
    expect(resolveStructuredModel(config, "classifyReply")).toBe("moonshotai/kimi-k2.6");
  });
});
