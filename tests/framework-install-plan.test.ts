import { describe, expect, it } from "vitest";

import { attioModule, buildModuleInstallPlan } from "../src/framework/index.js";

describe("framework module install plans", () => {
  it("summarizes how a module would be added", () => {
    const plan = buildModuleInstallPlan(attioModule());

    expect(plan.moduleId).toBe("attio");
    expect(plan.packageName).toBe("@ai-sdr/attio");
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
});
