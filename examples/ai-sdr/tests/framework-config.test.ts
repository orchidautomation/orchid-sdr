import { describe, expect, it } from "vitest";

import {
  aiSdrConfigSchema,
  buildProviderMap,
  collectConfigEnv,
  collectKnowledgePaths,
  collectWebhookDefinitions,
  collectPackageBoundaries,
  collectModuleDocs,
  collectModuleMcpServers,
  collectSkillPaths,
  defaultTrellisModules,
  defineAiSdr,
  providersFromModules,
  resolveProviderForCapability,
  validateAiSdrConfigReferences,
} from "@ai-sdr/framework";

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
      webhooks: [
        {
          id: "missing",
          displayName: "Missing provider webhook",
          method: "POST",
          path: "/webhooks/missing",
          providerId: "missing-provider",
          auth: "none",
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
      {
        severity: "error",
        code: "unknown_webhook_provider",
        message: 'Webhook "missing" references provider "missing-provider", but no provider with that id exists',
      },
    ]);
  });

  it("builds provider config from modules", () => {
    const modules = defaultTrellisModules();
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
    expect(config.modules?.some((item) => item.id === "convex")).toBe(true);
    expect(config.modules?.some((item) => item.id === "neon")).toBe(true);
    expect(config.modules?.some((item) => item.id === "rivet")).toBe(true);
    expect(config.providers?.some((item) => item.id === "attio")).toBe(true);
    expect(config.providers?.some((item) => item.id === "parallel")).toBe(true);
    expect(config.providers?.some((item) => item.id === "prospeo")).toBe(true);
    expect(collectConfigEnv(config).some((envVar) => envVar.name === "ATTIO_API_KEY")).toBe(true);
    expect(collectConfigEnv(config).some((envVar) => envVar.name === "NEXT_PUBLIC_CONVEX_URL")).toBe(true);
    expect(collectConfigEnv(config).some((envVar) => envVar.name === "RIVET_ENDPOINT")).toBe(true);
    expect(collectConfigEnv(config).some((envVar) => envVar.name === "PARALLEL_API_KEY")).toBe(true);
    expect(collectConfigEnv(config).some((envVar) => envVar.name === "PROSPEO_API_KEY")).toBe(true);
    expect(config.modules?.find((item) => item.id === "convex")?.contracts).toEqual([
      "state.reactive.v1",
      "state.workflow.v1",
      "state.agentThreads.v1",
      "state.auditLog.v1",
    ]);
    expect(config.modules?.find((item) => item.id === "firecrawl")?.capabilityIds).toEqual([
      "source",
      "search",
      "extract",
      "enrichment",
      "runtime",
      "observability",
    ]);
    expect(config.modules?.find((item) => item.id === "parallel")?.capabilityIds).toEqual([
      "search",
      "extract",
      "enrichment",
      "source",
      "observability",
    ]);
    expect(config.modules?.find((item) => item.id === "rivet")?.contracts).toContain("runtime.actor.v1");
    expect(config.modules?.find((item) => item.id === "parallel")?.contracts).toContain("research.monitor.v1");
    expect(config.modules?.find((item) => item.id === "prospeo")?.contracts).toContain("research.enrich.v1");
    expect(collectModuleDocs(config).some((doc) => doc.path === "docs/self-hosting.md")).toBe(true);
    expect(collectModuleMcpServers(config).some((server) => server.id === "parallel-search")).toBe(true);
    expect(collectModuleMcpServers(config).some((server) => server.id === "firecrawl")).toBe(true);
    expect(collectWebhookDefinitions(config)).toEqual([]);
    expect(config.modules?.flatMap((item) => item.contracts ?? [])).toContain("crm.prospectSync.v1");
    expect(validateAiSdrConfigReferences(config)).toEqual([]);
  });

  it("resolves stack providers from capability bindings and package boundaries", () => {
    const modules = defaultTrellisModules();
    const config = defineAiSdr({
      name: "composable-sdr",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      modules,
      providers: providersFromModules(modules),
      capabilityBindings: [
        {
          capabilityId: "search",
          providerId: "firecrawl",
          contractId: "research.search.v1",
          default: true,
        },
        {
          capabilityId: "search",
          providerId: "parallel",
          contractId: "research.deepResearch.v1",
          purpose: "deep_research",
        },
        {
          capabilityId: "extract",
          providerId: "firecrawl",
          contractId: "research.extract.v1",
          default: true,
        },
        {
          capabilityId: "observability",
          providerId: "parallel",
          contractId: "research.monitor.v1",
          purpose: "monitor",
        },
        {
          capabilityId: "enrichment",
          providerId: "prospeo",
          contractId: "research.enrich.v1",
          default: true,
        },
      ],
      packageBoundaries: [
        {
          id: "framework-core",
          packageName: "@ai-sdr/framework",
          visibility: "public",
          moduleIds: ["parallel", "firecrawl", "prospeo"],
          providerIds: ["parallel", "firecrawl", "prospeo"],
        },
      ],
    });

    expect(resolveProviderForCapability(config, {
      capabilityId: "search",
      contractId: "research.search.v1",
    })?.id).toBe("firecrawl");
    expect(resolveProviderForCapability(config, {
      capabilityId: "search",
      contractId: "research.deepResearch.v1",
    })?.id).toBe("parallel");
    expect(resolveProviderForCapability(config, {
      capabilityId: "extract",
      contractId: "research.extract.v1",
    })?.id).toBe("firecrawl");
    expect(resolveProviderForCapability(config, {
      capabilityId: "observability",
      contractId: "research.monitor.v1",
    })?.id).toBe("parallel");
    expect(resolveProviderForCapability(config, {
      capabilityId: "enrichment",
      contractId: "research.enrich.v1",
    })?.id).toBe("prospeo");
    expect(collectPackageBoundaries(config).map((boundary) => boundary.id)).toEqual(["framework-core"]);
    expect(validateAiSdrConfigReferences(config)).toEqual([]);
  });

  it("rejects capability bindings that are not backed by module contracts", () => {
    const modules = defaultTrellisModules();
    const config = defineAiSdr({
      name: "broken-bindings",
      knowledge: {
        product: "knowledge/product.md",
        icp: "knowledge/icp.md",
      },
      modules,
      providers: providersFromModules(modules),
      capabilityBindings: [
        {
          capabilityId: "search",
          providerId: "attio",
          contractId: "research.search.v1",
          default: true,
        },
      ],
      packageBoundaries: [
        {
          id: "broken-boundary",
          packageName: "@ai-sdr/framework",
          visibility: "public",
          moduleIds: ["missing-module"],
          providerIds: ["missing-provider"],
        },
      ],
    });

    expect(validateAiSdrConfigReferences(config)).toEqual([
      {
        severity: "error",
        code: "unsupported_capability_binding",
        message:
          'Capability binding "search" -> "attio" declares contract "research.search.v1", but no module for that provider exposes both the capability and contract',
      },
      {
        severity: "error",
        code: "unknown_package_boundary_module",
        message: 'Package boundary "broken-boundary" references unknown module "missing-module"',
      },
      {
        severity: "error",
        code: "unknown_package_boundary_provider",
        message: 'Package boundary "broken-boundary" references unknown provider "missing-provider"',
      },
    ]);
  });
});
