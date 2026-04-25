import { describe, expect, it } from "vitest";

import {
  aiSdrConfigSchema,
  buildProviderMap,
  collectConfigEnv,
  collectKnowledgePaths,
  collectModuleDocs,
  collectSkillPaths,
  defaultOrchidModules,
  defineAiSdr,
  providersFromModules,
  validateAiSdrConfigReferences,
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

  it("validates composition references", () => {
    const config = defineAiSdr({
      name: "test-sdr",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      providers: [
        {
          id: "hubspot",
          kind: "signal-source",
          displayName: "HubSpot",
        },
      ],
      campaigns: [
        {
          id: "default",
          sources: ["hubspot", "missing-provider"],
        },
      ],
    });

    expect(buildProviderMap(config).has("hubspot")).toBe(true);
    expect(validateAiSdrConfigReferences(config)).toEqual([
      {
        severity: "error",
        code: "unknown_campaign_source",
        message: 'Campaign "default" references source provider "missing-provider", but no provider with that id exists',
      },
    ]);
  });

  it("builds provider config from modules", () => {
    const modules = defaultOrchidModules();
    const config = defineAiSdr({
      name: "module-backed-sdr",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      modules,
      providers: providersFromModules(modules),
    });

    expect(config.modules?.some((item) => item.id === "attio")).toBe(true);
    expect(config.providers?.some((item) => item.id === "attio")).toBe(true);
    expect(collectConfigEnv(config).some((envVar) => envVar.name === "ATTIO_API_KEY")).toBe(true);
    expect(collectModuleDocs(config).some((doc) => doc.path === "docs/self-hosting.md")).toBe(true);
    expect(config.modules?.flatMap((item) => item.contracts ?? [])).toContain("crm.prospectSync.v1");
    expect(validateAiSdrConfigReferences(config)).toEqual([]);
  });
});
