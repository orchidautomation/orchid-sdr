import { describe, expect, it, vi } from "vitest";

let latestUse: any = null;

vi.mock("rivetkit", () => ({
  actor: (definition: any) => definition,
  setup: ({ use }: any) => {
    const wrapActor = (definition: any) => {
      const instances = new Map<string, any>();
      return {
        getOrCreate: (key?: unknown) => {
          const instanceKey = JSON.stringify(key ?? []);
          const existing = instances.get(instanceKey);
          if (existing) {
            return existing;
          }
          const state = structuredClone(definition.state ?? {});
          const schedule = {
            after: vi.fn(async () => undefined),
          };
          const db = {
            execute: vi.fn(async () => []),
          };
          const actions = Object.fromEntries(
            Object.entries(definition.actions ?? {}).map(([name, action]) => [
              name,
              async (input?: unknown) => (action as any)({ state, schedule, db }, input),
            ]),
          );
          instances.set(instanceKey, actions);
          return actions;
        },
      };
    };

    latestUse = {
      sourceIngest: wrapActor(use.sourceIngest),
      prospectThread: wrapActor(use.prospectThread),
      campaignOps: wrapActor(use.campaignOps),
      sandboxBroker: wrapActor(use.sandboxBroker),
    };

    return {
      parseConfig: () => ({
        endpoint: "http://127.0.0.1:6420",
        managerPort: 6420,
        token: undefined,
        namespace: undefined,
      }),
      ...latestUse,
      discoveryCoordinator: use.discoveryCoordinator,
    };
  },
}));

vi.mock("rivetkit/db", () => ({
  db: () => ({}),
}));

vi.mock("rivetkit/client", () => ({
  createClient: () => ({
    prospectThread: {
      getOrCreate: (...args: any[]) => latestUse.prospectThread.getOrCreate(...args),
    },
  }),
}));

describe("createDefaultSdrRegistry", () => {
  it("routes discovery-driven lifecycle work through the prospectThread actor", async () => {
    const ingestApifyRun = vi.fn(async (_runtime, _input) => {
      await _runtime.dispatchProspectLifecycle({
        prospectId: "pros_1",
      });
      return { ok: true };
    });
    const runLifecycle = vi.fn(async (input: { prospectId: string; forceFollowup?: boolean }) => ({
      action: "researched",
      prospectId: input.prospectId,
      threadId: "thr_1",
    }));

    const { createDefaultSdrRegistry } = await import("./actor-registry.js");
    const registry = createDefaultSdrRegistry({
      getContext: () => ({
        repository: {
          ensureDefaultCampaign: async () => ({ id: "cmp_default" }),
          createOrUpdateProspectFromSignal: async () => ({ prospectId: "pros_1", threadId: "thr_1" }),
          setControlFlag: async () => undefined,
          getControlFlags: async () => ({ pausedCampaignIds: [] }),
          setCampaignLinkedinSource: async () => undefined,
        },
      }),
      createId: () => "job_1",
      ingestApifyRun,
      executeProspectWorkflow: vi.fn(async () => ({
        action: "noop",
      })),
      processInboundReply: vi.fn(async () => null),
      runSandboxTurn: vi.fn(async () => ({
        turnId: "turn_1",
        outputText: "ok",
        transcript: [],
      })),
      discoveryCoordinator: {},
      managerHost: "127.0.0.1",
      managerPort: 6420,
    } as any);

    const prospectThreadActor = latestUse.prospectThread.getOrCreate(["pros_1"]);
    vi.spyOn(prospectThreadActor as any, "runLifecycle").mockImplementation(async (input: any) => {
      runLifecycle(input);
      return {
        action: "researched",
        prospectId: input.prospectId,
        threadId: "thr_1",
      };
    });

    await (registry as any).sourceIngest.getOrCreate().ingestApifyRun({
      actorRunId: "run_1",
      source: "linkedin_public_post",
      campaignId: "cmp_default",
    });

    expect(ingestApifyRun).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchProspectLifecycle: expect.any(Function),
      }),
      expect.objectContaining({
        actorRunId: "run_1",
      }),
    );
    expect(runLifecycle).toHaveBeenCalledWith({
      prospectId: "pros_1",
      forceFollowup: undefined,
    });
  });

  it("bootstraps prospect lifecycle state from a signal and schedules followup work", async () => {
    const executeProspectWorkflow = vi.fn(async () => ({
      action: "queued-followup",
      prospectId: "pros_99",
      threadId: "thr_99",
      followupDelayMs: 30_000,
    }));

    const { createDefaultSdrRegistry } = await import("./actor-registry.js");
    const registry = createDefaultSdrRegistry({
      getContext: () => ({
        repository: {
          ensureDefaultCampaign: async () => ({ id: "cmp_default" }),
          createOrUpdateProspectFromSignal: async () => ({ prospectId: "pros_99", threadId: "thr_99" }),
          setControlFlag: async () => undefined,
          getControlFlags: async () => ({ pausedCampaignIds: [] }),
          setCampaignLinkedinSource: async () => undefined,
        },
      }),
      createId: () => "job_2",
      ingestApifyRun: vi.fn(async () => ({ ok: true })),
      executeProspectWorkflow,
      processInboundReply: vi.fn(async () => null),
      runSandboxTurn: vi.fn(async () => ({
        turnId: "turn_2",
        outputText: "ok",
        transcript: [],
      })),
      discoveryCoordinator: {},
      managerHost: "127.0.0.1",
      managerPort: 6420,
    } as any);

    const actor = latestUse.prospectThread.getOrCreate(["pros_99"]);
    const outcome = await actor.bootstrapFromSignal({
      signalId: "sig_99",
      campaignId: "cmp_default",
    });

    expect(executeProspectWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      "pros_99",
    );
    expect(outcome).toMatchObject({
      action: "queued-followup",
      prospectId: "pros_99",
      threadId: "thr_99",
    });
  });
});
