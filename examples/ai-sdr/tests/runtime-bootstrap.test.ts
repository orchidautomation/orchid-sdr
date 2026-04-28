import { beforeEach, describe, expect, it, vi } from "vitest";

const migrateDatabase = vi.fn(async () => {});
const runSandboxCompatibilityProbe = vi.fn(async () => {});
const registryStart = vi.fn();
const parseConfig = vi.fn(() => ({
  endpoint: "https://api.rivet.dev",
}));
const ensureDefaultCampaign = vi.fn(async () => ({
  id: "cmp_default",
}));
const setControlFlag = vi.fn(async () => {});
const initialize = vi.fn(async () => {});
const enqueueTick = vi.fn(async () => {
  throw new Error("actor failed to start");
});

vi.mock("../src/db/migrate.js", () => ({
  migrateDatabase,
}));

vi.mock("../src/services/sandbox-probe.js", () => ({
  runSandboxCompatibilityProbe,
}));

vi.mock("../src/registry.js", () => ({
  registry: {
    start: registryStart,
    parseConfig,
  },
}));

vi.mock("../src/services/runtime-context.js", () => ({
  getAppContext: () => ({
    repository: {
      ensureDefaultCampaign,
      setControlFlag,
    },
    config: {
      NO_SENDS_MODE: true,
      SANDBOX_COMPAT_PROBE_ON_STARTUP: false,
      DISCOVERY_LINKEDIN_ENABLED: true,
      DISCOVERY_X_ENABLED: false,
    },
  }),
}));

vi.mock("../src/services/actor-client.js", () => ({
  getActorClient: () => ({
    discoveryCoordinator: {
      getOrCreate: () => ({
        initialize,
        enqueueTick,
      }),
    },
  }),
}));

describe("ensureRuntimeBootstrapped", () => {
  beforeEach(() => {
    vi.resetModules();
    migrateDatabase.mockClear();
    runSandboxCompatibilityProbe.mockClear();
    registryStart.mockClear();
    parseConfig.mockClear();
    ensureDefaultCampaign.mockClear();
    setControlFlag.mockClear();
    initialize.mockClear();
    enqueueTick.mockClear();
  });

  it("does not reject when discovery actor bootstrap fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { ensureRuntimeBootstrapped } = await import("../src/services/runtime-bootstrap.js");

    await expect(ensureRuntimeBootstrapped()).resolves.toBeUndefined();
    expect(migrateDatabase).not.toHaveBeenCalled();
    expect(ensureDefaultCampaign).toHaveBeenCalledTimes(2);
    expect(setControlFlag).toHaveBeenCalledWith("no_sends_mode", {
      enabled: true,
    });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(enqueueTick).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "Non-fatal runtime bootstrap failure: discovery actor bootstrap",
      expect.any(Error),
    );

    errorSpy.mockRestore();
  });
});
