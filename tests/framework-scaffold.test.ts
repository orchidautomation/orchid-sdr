import { describe, expect, it } from "vitest";

import baseConfig from "../ai-sdr.config.js";
import {
  buildScaffoldSpec,
  renderScaffoldConfigModule,
  renderScaffoldEnvExample,
  renderScaffoldSetupChecklist,
} from "../src/framework/scaffold.js";

describe("framework scaffold profiles", () => {
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
    expect(setupChecklist).toContain("`CONVEX_URL`");
    expect(setupChecklist).not.toContain("`DATABASE_URL`");
  });
});
