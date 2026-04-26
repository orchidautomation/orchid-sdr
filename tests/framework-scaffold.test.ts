import { describe, expect, it } from "vitest";

import baseConfig from "../ai-sdr.config.js";
import {
  aiSdrInitModuleChoices,
  buildScaffoldSpec,
  renderScaffoldConfigModule,
  renderScaffoldEnvExample,
  renderScaffoldSetupChecklist,
  resolveInitModuleIds,
} from "@ai-sdr/framework/scaffold";

describe("framework scaffold profiles", () => {
  it("builds a demo scaffold for manual signal workflows", () => {
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-demo",
      profile: "demo",
    });

    expect(spec.profile.id).toBe("demo");
    expect(spec.profile.defaultDirectoryName).toBe("trellis-demo");
    expect(spec.config.compositionTargets).toEqual(["minimum"]);
    expect(spec.config.campaigns?.[0]?.sources).toEqual(["normalized-webhook"]);
    expect(spec.selectedModules.map((module) => module.id)).toEqual([
      "normalized-webhook",
      "firecrawl",
      "convex",
      "vercel-ai-gateway",
      "rivet",
      "vercel-sandbox",
      "orchid-mcp",
    ]);
  });

  it("builds a core scaffold without optional providers", () => {
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-core",
      profile: "core",
    });

    expect(spec.profile.id).toBe("core");
    expect(spec.config.compositionTargets).toEqual(["minimum"]);
    expect(spec.selectedModules.map((module) => module.id)).toEqual([
      "normalized-webhook",
      "firecrawl",
      "convex",
      "vercel-ai-gateway",
      "rivet",
      "vercel-sandbox",
      "orchid-mcp",
    ]);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "parallel")).toBe(false);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "prospeo")).toBe(false);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "attio")).toBe(false);
  });

  it("builds a production scaffold with production parity targets", () => {
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-prod",
      profile: "production",
    });

    expect(spec.profile.id).toBe("production");
    expect(spec.config.compositionTargets).toEqual(["minimum", "productionParity"]);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "parallel")).toBe(true);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "attio")).toBe(true);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "agentmail")).toBe(true);
    expect(spec.config.campaigns?.[0]?.sources).toEqual(["normalized-webhook", "apify-linkedin"]);
  });

  it("can extend a demo scaffold with optional module choices", () => {
    const moduleIds = resolveInitModuleIds("demo", {
      include: ["discovery", "deep-research"],
    });
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-demo-plus",
      profile: "demo",
      moduleIds,
    });

    expect(aiSdrInitModuleChoices.map((choice) => choice.id)).toContain("discovery");
    expect(spec.selectedModules.map((module) => module.id)).toContain("apify-linkedin");
    expect(spec.selectedModules.map((module) => module.id)).toContain("parallel");
    expect(spec.config.campaigns?.[0]?.sources).toEqual(["normalized-webhook", "apify-linkedin"]);
  });

  it("drops production parity when optional production modules are removed", () => {
    const moduleIds = resolveInitModuleIds("production", {
      exclude: ["crm", "email", "handoff"],
    });
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-prod-lite",
      profile: "production",
      moduleIds,
    });

    expect(spec.config.compositionTargets).toEqual(["minimum"]);
    expect(spec.selectedModules.map((module) => module.id)).not.toContain("attio");
    expect(spec.selectedModules.map((module) => module.id)).not.toContain("agentmail");
    expect(spec.selectedModules.map((module) => module.id)).not.toContain("slack-handoff");
  });

  it("renders scaffold config and env example content", () => {
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-starter",
      profile: "starter",
    });

    const configModule = renderScaffoldConfigModule(spec);
    const envExample = renderScaffoldEnvExample(spec);
    const setupChecklist = renderScaffoldSetupChecklist(spec);

    expect(configModule).toContain('from "@ai-sdr/framework"');
    expect(configModule).toContain('const selectedModuleIds =');
    expect(configModule).toContain('"compositionTargets": [');
    expect(configModule).toContain('"name": "trellis-starter"');
    expect(configModule).not.toContain('./src/framework/index.js');
    expect(envExample).toContain("CONVEX_URL=https://your-deployment.convex.cloud");
    expect(envExample).toContain("FIRECRAWL_API_KEY=");
    expect(envExample).toContain("PARALLEL_API_KEY=");
    expect(envExample).toContain("ORCHID_SDR_SANDBOX_TOKEN=change-me");
    expect(setupChecklist).toContain("# Trellis Setup Checklist");
    expect(setupChecklist).toContain(spec.profile.description);
    expect(setupChecklist).toContain("`CONVEX_URL`");
    expect(setupChecklist).not.toContain("`DATABASE_URL`");
  });
});
