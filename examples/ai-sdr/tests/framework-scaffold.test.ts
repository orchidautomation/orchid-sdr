import { describe, expect, it } from "vitest";

import baseConfig from "../trellis.config.js";
import {
  aiSdrInitModuleChoices,
  buildScaffoldSpec,
  renderScaffoldConfigModule,
  renderScaffoldEnvExample,
  renderScaffoldSetupChecklist,
  resolveInitModuleIds,
} from "@ai-sdr/framework/scaffold";

describe("framework scaffold profiles", () => {
  it("builds a core scaffold for manual signal workflows", () => {
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-core",
      profile: "core",
    });

    expect(spec.profile.id).toBe("core");
    expect(spec.selection.id).toBe("core");
    expect(spec.profile.defaultDirectoryName).toBe("trellis-core");
    expect(spec.config.compositionTargets).toEqual(["minimum"]);
    expect(spec.config.campaigns?.[0]?.sources).toEqual(["normalized-webhook"]);
    expect(spec.selectedModules.map((module) => module.id)).toEqual([
      "normalized-webhook",
      "convex",
      "vercel-ai-gateway",
      "rivet",
      "vercel-sandbox",
      "trellis-mcp",
    ]);
  });

  it("treats the legacy demo profile as a core alias", () => {
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-demo",
      profile: "demo",
    });

    expect(spec.profile.id).toBe("core");
    expect(spec.profile.defaultDirectoryName).toBe("trellis-core");
    expect(spec.config.compositionTargets).toEqual(["minimum"]);
    expect(spec.selectedModules.map((module) => module.id)).toEqual([
      "normalized-webhook",
      "convex",
      "vercel-ai-gateway",
      "rivet",
      "vercel-sandbox",
      "trellis-mcp",
    ]);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "parallel")).toBe(false);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "prospeo")).toBe(false);
    expect(spec.config.capabilityBindings?.some((binding) => binding.providerId === "attio")).toBe(false);
  });

  it("can extend a core scaffold with optional module choices", () => {
    const moduleIds = resolveInitModuleIds("core", {
      include: ["discovery", "deep-research"],
    });
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-core-plus",
      profile: "core",
      moduleIds,
    });

    expect(aiSdrInitModuleChoices.map((choice) => choice.id)).toContain("discovery");
    expect(spec.selection.id).toBe("custom");
    expect(spec.selection.displayName).toBe("Custom Trellis stack");
    expect(spec.selectedModules.map((module) => module.id)).toContain("apify-linkedin");
    expect(spec.selectedModules.map((module) => module.id)).toContain("parallel");
    expect(spec.config.campaigns?.[0]?.sources).toEqual(["normalized-webhook", "apify-linkedin"]);
  });

  it("can reach production parity by starting from core and toggling all optional lanes on", () => {
    const moduleIds = resolveInitModuleIds("core", {
      include: ["discovery", "deep-research", "enrichment", "crm", "email", "handoff"],
    });
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-core-prod",
      profile: "core",
      moduleIds,
    });

    expect(spec.profile.id).toBe("core");
    expect(spec.selection.id).toBe("custom");
    expect(spec.config.compositionTargets).toEqual(["minimum", "productionParity"]);
  });

  it("can remove optional lanes from the core scaffold explicitly", () => {
    const moduleIds = resolveInitModuleIds("core", {
      include: ["discovery", "crm", "email"],
      exclude: ["crm"],
    });
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-core-lite",
      profile: "core",
      moduleIds,
    });

    expect(spec.config.compositionTargets).toEqual(["minimum"]);
    expect(spec.selectedModules.map((module) => module.id)).toContain("apify-linkedin");
    expect(spec.selectedModules.map((module) => module.id)).toContain("agentmail");
    expect(spec.selectedModules.map((module) => module.id)).not.toContain("attio");
  });

  it("renders scaffold config and env example content", () => {
    const spec = buildScaffoldSpec(baseConfig, {
      name: "trellis-core",
      profile: "core",
    });

    const configModule = renderScaffoldConfigModule(spec);
    const envExample = renderScaffoldEnvExample(spec);
    const setupChecklist = renderScaffoldSetupChecklist(spec);

    expect(configModule).toContain('from "@ai-sdr/framework"');
    expect(configModule).toContain('const scaffoldName = "trellis-core"');
    expect(configModule).toContain('const selectedModuleIds =');
    expect(configModule).toContain('"compositionTargets": [');
    expect(configModule).toContain('"name": scaffoldName');
    expect(configModule).not.toContain('"mcp": {');
    expect(configModule).toContain('"capabilityId": "mcp"');
    expect(configModule).not.toContain('./src/framework/index.js');
    expect(envExample).toContain("CONVEX_URL=https://your-deployment.convex.cloud");
    expect(envExample).toContain("TRELLIS_SANDBOX_TOKEN=change-me");
    expect(envExample).toContain("TRELLIS_MCP_TOKEN=");
    expect(envExample).toContain("DASHBOARD_PASSWORD=");
    expect(setupChecklist).toContain("# Trellis Setup Checklist");
    expect(setupChecklist).toContain(spec.selection.description);
    expect(setupChecklist).toContain("External Accounts You Actually Need");
    expect(setupChecklist).toContain("Vercel OAuth is **not** part of the default Trellis auth story right now.");
    expect(setupChecklist).toContain("Deployed MCP endpoint");
    expect(setupChecklist).toContain("npm run trellis -- mcp claude-code --local --write");
    expect(setupChecklist).not.toContain("npm run ai-sdr --");
    expect(setupChecklist).toContain("Configured Webhooks");
    expect(configModule).toContain('"webhooks": [');
    expect(setupChecklist).toContain("`CONVEX_URL`");
    expect(setupChecklist).not.toContain("db:migrate");
  });
});
