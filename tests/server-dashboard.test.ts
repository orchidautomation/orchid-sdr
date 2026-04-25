import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureRuntimeBootstrapped = vi.fn();
const getAppContext = vi.fn();
let mockClient: any;

vi.mock("../src/services/runtime-bootstrap.js", () => ({
  ensureRuntimeBootstrapped,
  shouldSkipLocalRivetRuntime: vi.fn(() => false),
  shouldUseRemoteRivetRuntime: vi.fn(() => true),
}));

vi.mock("../src/services/runtime-context.js", () => ({
  getAppContext,
}));

vi.mock("../src/services/actor-client.js", () => ({
  getActorClient: vi.fn(() => mockClient),
}));

vi.mock("../src/registry.js", () => ({
  registry: {
    handler: vi.fn(async () => new Response("{}")),
    parseConfig: vi.fn(() => ({
      endpoint: "https://api.rivet.dev",
    })),
    start: vi.fn(),
  },
}));

vi.mock("../src/mcp/server-factory.js", () => ({
  createOrchidMcpServer: vi.fn(),
}));

vi.mock("../src/orchestration/webhook-handlers.js", () => ({
  handleAgentMailWebhook: vi.fn(),
  handleHandoffWebhook: vi.fn(),
  handleSignalWebhook: vi.fn(),
}));

vi.mock("../src/orchestration/sandbox-broker.js", () => ({
  runSandboxTurn: vi.fn(),
}));

describe("dashboard bootstrap bypass", () => {
  beforeEach(() => {
    vi.resetModules();
    ensureRuntimeBootstrapped.mockReset();
    ensureRuntimeBootstrapped.mockRejectedValue(new Error("bootstrap failed"));
    getAppContext.mockReset();
    const discoveryActor = {
      pauseAutomation: vi.fn(async () => ({
        ok: true,
      })),
      initialize: vi.fn(async () => ({
        ok: true,
        scheduledNextTickAt: 1234,
      })),
      getSnapshot: vi.fn(async () => null),
    };
    const sandboxActor = {
      listJobs: vi.fn(async () => []),
      getSnapshot: vi.fn(async () => null),
      enqueueTurn: vi.fn(),
    };
    mockClient = {
      discoveryCoordinator: {
        getOrCreate: vi.fn(() => discoveryActor),
      },
      sandboxBroker: {
        getOrCreate: vi.fn(() => sandboxActor),
      },
      campaignOps: {
        getOrCreate: vi.fn(() => ({
          pauseCampaign: vi.fn(async () => ({ ok: true, pausedCampaignIds: ["cmp_default"] })),
          resumeCampaign: vi.fn(async () => ({ ok: true, pausedCampaignIds: [] })),
          getSnapshot: vi.fn(async () => null),
        })),
      },
      sourceIngest: {
        getOrCreate: vi.fn(() => ({
          getSnapshot: vi.fn(async () => null),
        })),
      },
    };
    getAppContext.mockReturnValue({
      config: {
        DASHBOARD_PASSWORD: "orchid-password",
        ORCHID_SDR_SANDBOX_TOKEN: "sandbox-token",
        DISCOVERY_LINKEDIN_ENABLED: true,
        DISCOVERY_X_ENABLED: false,
      },
      repository: {
        ensureDefaultCampaign: vi.fn(async () => ({
          id: "cmp_default",
        })),
        getDashboardSummary: vi.fn(async () => ({
          signals: 0,
          prospects: 0,
          qualified: 0,
          activeThreads: 0,
          pausedThreads: 0,
          providerRuns24h: 0,
        })),
        listRecentSignals: vi.fn(async () => []),
        listRecentProspects: vi.fn(async () => []),
        listQualifiedLeads: vi.fn(async () => []),
        listActiveThreads: vi.fn(async () => []),
        listRecentProviderRuns: vi.fn(async () => []),
        listRecentAuditEvents: vi.fn(async () => []),
        getControlFlags: vi.fn(async () => ({
          globalKillSwitch: false,
          noSendsMode: true,
          pausedCampaignIds: ["cmp_default"],
        })),
      },
      security: {},
      agentMail: {
        isConfigured: () => false,
      },
    });
  });

  it("renders the dashboard login page even when runtime bootstrap fails", async () => {
    const { createApp } = await import("../src/server.js");
    const app = createApp();

    const response = await app.request("/dashboard");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("Open dashboard");
    expect(ensureRuntimeBootstrapped).not.toHaveBeenCalled();
  });

  it("pauses discovery automation without aborting in-flight runs", async () => {
    ensureRuntimeBootstrapped.mockResolvedValue(undefined);
    const { createApp } = await import("../src/server.js");
    const app = createApp();
    const cookie = "orchid_dashboard_auth="
      + "12be3e4ce790b3c729fe1c5025ed58bbcf2fddd134dc770490a256cc0d9417cb";

    const response = await app.request("/api/dashboard/automation-pause", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        paused: true,
      }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      paused: true,
      campaignId: "cmp_default",
      discovery: [
        {
          source: "linkedin_public_post",
          sourcePaused: true,
        },
      ],
    });
    expect(mockClient.discoveryCoordinator.getOrCreate).toHaveBeenCalledWith([
      "cmp_default",
      "linkedin_public_post",
    ]);
  });

  it("returns dashboard state even when sandbox job listing fails", async () => {
    ensureRuntimeBootstrapped.mockResolvedValue(undefined);
    const sandboxActor = mockClient.sandboxBroker.getOrCreate();
    sandboxActor.listJobs.mockRejectedValueOnce(new Error("actor failed to start"));
    const { createApp } = await import("../src/server.js");
    const app = createApp();
    const cookie = "orchid_dashboard_auth="
      + "12be3e4ce790b3c729fe1c5025ed58bbcf2fddd134dc770490a256cc0d9417cb";

    const response = await app.request("/api/dashboard/state", {
      headers: {
        cookie,
      },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      campaignId: "cmp_default",
      sandboxJobs: [],
      summary: {
        prospects: 0,
      },
    });
  });
});
