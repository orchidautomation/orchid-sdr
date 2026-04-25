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
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "extract", provider: "firecrawl" })?.id).toBe("firecrawl");
    expect(findModuleForAddCommand(modules, { capabilityOrModule: "database", provider: "neon" })?.id).toBe("neon");
  });
});
