import { describe, expect, it } from "vitest";

import {
  aiSdrConfigSchema,
  collectConfigEnv,
  collectKnowledgePaths,
  collectSkillPaths,
  defineAiSdr,
} from "../src/framework/index.js";

describe("AI SDR framework config helpers", () => {
  it("collects knowledge and skill paths", () => {
    const config = defineAiSdr({
      name: "test-sdr",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      skills: [
        {
          id: "qualification",
          path: "skills/qualification",
        },
      ],
    });

    expect(collectKnowledgePaths(config)).toEqual(["knowledge/product.md", "knowledge/icp.md"]);
    expect(collectSkillPaths(config)).toEqual(["skills/qualification"]);
  });

  it("deduplicates env vars and preserves required flags", () => {
    const config = defineAiSdr({
      name: "test-sdr",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      requiredEnv: [
        {
          name: "DATABASE_URL",
          required: true,
        },
      ],
      providers: [
        {
          id: "crm",
          kind: "crm",
          displayName: "CRM",
          env: [
            {
              name: "DATABASE_URL",
            },
            {
              name: "CRM_API_KEY",
            },
          ],
        },
      ],
    });

    expect(collectConfigEnv(config)).toEqual([
      {
        name: "CRM_API_KEY",
      },
      {
        name: "DATABASE_URL",
        required: true,
        description: undefined,
      },
    ]);
  });

  it("exposes a runtime schema for framework configs", () => {
    const parsed = aiSdrConfigSchema.parse({
      name: "schema-backed-sdr",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      providers: [
        {
          id: "attio",
          kind: "crm",
          displayName: "Attio",
        },
      ],
    });

    expect(parsed.providers?.[0]?.kind).toBe("crm");
    expect(() =>
      aiSdrConfigSchema.parse({
        name: "broken",
        knowledge: {
          product: "knowledge/product.md",
        },
      }),
    ).toThrow();
  });
});
