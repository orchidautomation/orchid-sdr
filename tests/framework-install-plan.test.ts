import { describe, expect, it } from "vitest";

import {
  attioModule,
  buildModuleInstallPlan,
  defaultOrchidModules,
  findModuleForAddCommand,
} from "../src/framework/index.js";

describe("framework module install plans", () => {
  it("summarizes how a module would be added", () => {
    const plan = buildModuleInstallPlan(attioModule());

    expect(plan.moduleId).toBe("attio");
    expect(plan.packageName).toBe("@ai-sdr/attio");
    expect(plan.providerKey).toBe("attio");
    expect(plan.capabilityIds).toEqual(["crm"]);
    expect(plan.contracts).toEqual(["crm.prospectSync.v1", "crm.stageUpdate.v1"]);
    expect(plan.providers).toEqual(["attio"]);
    expect(plan.mcpServers).toEqual([]);
    expect(plan.mcpTools).toEqual([]);
    expect(plan.envVars).toContain("ATTIO_API_KEY");
    expect(plan.smokeChecks).toContain("crm.syncProspect");
    expect(plan.nextSteps.some((step) => step.includes("npm run doctor"))).toBe(true);
  });

  it("marks already-installed modules", () => {
    const plan = buildModuleInstallPlan(attioModule(), {
      installedModuleIds: ["attio"],
    });

    expect(plan.alreadyInstalled).toBe(true);
    expect(plan.nextSteps[0]).toContain("already present");
  });

  it("resolves capability and provider pairs", () => {
    const modules = defaultOrchidModules();

    expect(findModuleForAddCommand(modules, { capabilityOrModule: "crm", provider: "attio" })?.id).toBe("attio");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "research", provider: "parallel" })?.id).toBe("parallel");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "search", provider: "parallel" })?.id).toBe("parallel");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "extract", provider: "parallel" })?.id).toBe("parallel");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "enrichment", provider: "parallel" })?.id).toBe("parallel");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "search", provider: "firecrawl" })?.id).toBe("firecrawl");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "extract", provider: "firecrawl" })?.id).toBe("firecrawl");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "database", provider: "neon" })?.id).toBe("neon");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "source", provider: "apify" })?.id).toBe("apify-linkedin");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "source", provider: "webhook" })?.id).toBe("normalized-webhook");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "model", provider: "vercel-ai-gateway" })?.id).toBe("vercel-ai-gateway");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "runtime", provider: "vercel-sandbox" })?.id).toBe("vercel-sandbox");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "handoff", provider: "slack" })?.id).toBe("slack-handoff");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "mcp", provider: "orchid-mcp" })?.id).toBe("orchid-mcp");
  });

  it("indexes MCP servers and tool capabilities", () => {
    const parallelPlan = buildModuleInstallPlan(
      findModuleForAddCommand(defaultOrchidModules(), { capabilityOrModule: "search", provider: "parallel" })!,
    );
    const firecrawlPlan = buildModuleInstallPlan(
      findModuleForAddCommand(defaultOrchidModules(), { capabilityOrModule: "extract", provider: "firecrawl" })!,
    );

    expect(parallelPlan.mcpServers).toContain("parallel-search: https://search.parallel.ai/mcp");
    expect(parallelPlan.mcpServers).toContain("parallel-task: https://task-mcp.parallel.ai/mcp");
    expect(parallelPlan.mcpTools).toContain("parallel-search.web_search: search, source");
    expect(parallelPlan.mcpTools).toContain("parallel-task.createTaskGroup: enrichment");
    expect(firecrawlPlan.mcpServers).toContain("firecrawl: https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp");
    expect(firecrawlPlan.mcpTools).toContain("firecrawl.firecrawl_scrape: extract");
    expect(firecrawlPlan.mcpTools).toContain("firecrawl.firecrawl_browser_execute: runtime, extract");
  });
});
