import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureRuntimeBootstrapped = vi.fn();
const getAppContext = vi.fn();

vi.mock("../src/services/runtime-bootstrap.js", () => ({
  ensureRuntimeBootstrapped,
  shouldSkipLocalRivetRuntime: vi.fn(() => false),
  shouldUseRemoteRivetRuntime: vi.fn(() => true),
}));

vi.mock("../src/services/runtime-context.js", () => ({
  getAppContext,
}));

vi.mock("../src/services/actor-client.js", () => ({
  getActorClient: vi.fn(() => ({
    discoveryCoordinator: {
      getOrCreate: vi.fn(),
    },
    sandboxBroker: {
      getOrCreate: vi.fn(),
    },
    campaignOps: {
      getOrCreate: vi.fn(),
    },
  })),
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
    getAppContext.mockReturnValue({
      config: {
        DASHBOARD_PASSWORD: "orchid-password",
        ORCHID_SDR_SANDBOX_TOKEN: "sandbox-token",
      },
      repository: {},
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
});
