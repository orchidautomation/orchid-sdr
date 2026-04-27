import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("getAppContext local smoke mode", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      TRELLIS_LOCAL_SMOKE_MODE: "true",
      ORCHID_SDR_SANDBOX_TOKEN: "local-sandbox-token",
      HANDOFF_WEBHOOK_SECRET: "local-handoff-secret",
      DISCOVERY_LINKEDIN_ENABLED: "false",
      DISCOVERY_X_ENABLED: "false",
    };
    delete process.env.CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("boots a local smoke context without Convex", async () => {
    const { resetConfigForTests } = await import("../src/config.js");
    const { getAppContext, resetAppContextForTests } = await import("../src/services/runtime-context.js");

    resetConfigForTests();
    resetAppContextForTests();

    const context = getAppContext();
    const campaign = await context.repository.ensureDefaultCampaign();

    expect(context.localSmokeMode).toBe(true);
    expect(context.state.providerId).toBe("disabled");
    expect(campaign.id).toBe("cmp_default");
    expect(await context.repository.getDashboardSummary()).toMatchObject({
      signals: 0,
      prospects: 0,
      qualifiedLeads: 0,
    });
  });
});
