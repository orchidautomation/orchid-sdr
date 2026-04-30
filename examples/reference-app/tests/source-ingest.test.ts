import { describe, expect, it, vi } from "vitest";

vi.mock("../src/orchestration/prospect-workflow.js", () => ({
  executeProspectWorkflow: vi.fn(async (_deps, prospectId: string) => ({
    action: "researched",
    prospectId,
    threadId: "thr_1",
    reason: "test workflow",
  })),
}));

import { ingestSignalWebhook, normalizeSignalWebhookPayload } from "../src/orchestration/source-ingest.js";
import { executeProspectWorkflow } from "../src/orchestration/prospect-workflow.js";

describe("normalizeSignalWebhookPayload", () => {
  it("normalizes a single arbitrary-source signal payload", () => {
    const result = normalizeSignalWebhookPayload({
      provider: "custom-source",
      source: "reddit_post",
      externalId: "run_123",
      signal: {
        url: "https://reddit.com/r/example/post",
        authorName: "Casey",
        authorTitle: "Growth Operator",
        authorCompany: "Launch Labs",
        companyDomain: "launchlabs.io",
        topic: "signal-based GTM",
        content: "We are rebuilding our outbound workflow stack.",
      },
    });

    expect(result.provider).toBe("custom-source");
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.source).toBe("reddit_post");
    expect(result.signals[0]?.signal.authorName).toBe("Casey");
    expect(result.signals[0]?.signal.topic).toBe("signal-based GTM");
  });

  it("accepts mixed-source batches and derives a stable sourceRef when absent", () => {
    const result = normalizeSignalWebhookPayload({
      provider: "batch-import",
      signals: [
        {
          source: "x_public_post",
          url: "https://x.com/example/status/1",
          name: "Jordan",
          title: "RevOps Lead",
          company: "Northstar",
          text: "We adopted Clay last month.",
        },
        {
          source: "podcast_mention",
          url: "https://example.fm/episodes/123",
          author: "Avery",
          role: "Founder",
          companyName: "Northstar",
          description: "Talking about GTM systems and agent workflows.",
        },
      ],
    });

    expect(result.signals).toHaveLength(2);
    expect(result.signals[0]?.signal.sourceRef).toBeTruthy();
    expect(result.signals[1]?.source).toBe("podcast_mention");
    expect(result.signals[1]?.signal.content).toMatch(/GTM systems/);
  });

  it("writes signal and workflow checkpoints to the state plane", async () => {
    const repository = {
      ensureDefaultCampaign: vi.fn(async () => ({ id: "cmp_default" })),
      getControlFlags: vi.fn(async () => ({
        globalKillSwitch: false,
        noSendsMode: false,
        pausedCampaignIds: [],
      })),
      recordProviderRun: vi.fn(async () => "run_1"),
      insertSignal: vi.fn(async () => "sig_1"),
      appendAuditEvent: vi.fn(async () => undefined),
      pauseThread: vi.fn(async () => undefined),
      createOrUpdateProspectFromSignal: vi.fn(async () => ({ prospectId: "pros_1", threadId: "thr_1" })),
      updateProviderRun: vi.fn(async () => undefined),
    };
    const state = {
      recordSignal: vi.fn(async () => ({
        providerId: "convex",
        stateSignalId: "state_sig_1",
        stored: true,
      })),
      recordWorkflowCheckpoint: vi.fn(async () => ({
        providerId: "convex",
        checkpointId: "chk_1",
        stored: true,
      })),
      appendAuditEvent: vi.fn(async () => ({
        providerId: "convex",
        auditEventId: "aud_1",
        stored: true,
      })),
    };

    const result = await ingestSignalWebhook(
      {
        context: {
          repository,
          state,
        },
        runSandboxTurn: vi.fn(),
      } as any,
      {
        provider: "custom-source",
        source: "reddit_post",
        signal: {
          url: "https://reddit.com/r/example/post",
          authorName: "Casey",
          authorTitle: "Growth Operator",
          authorCompany: "Launch Labs",
          companyDomain: "launchlabs.io",
          topic: "signal-based GTM",
          content: "We are rebuilding our outbound workflow stack.",
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      batches: 1,
      signalsReceived: 1,
    });
    expect(state.recordSignal).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: "cmp_default",
      provider: "custom-source",
      source: "reddit_post",
      localSignalId: "sig_1",
      signal: expect.objectContaining({
        authorName: "Casey",
        topic: "signal-based GTM",
      }),
    }));
    expect(state.recordWorkflowCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      workflowName: "signal-ingest",
      entityType: "providerRun",
      entityId: "run_1",
      step: "started",
      status: "running",
      runtimeProvider: "rivet",
    }));
    expect(state.recordWorkflowCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      workflowName: "signal-ingest",
      entityType: "signal",
      entityId: "sig_1",
      step: "captured",
      status: "succeeded",
    }));
    expect(state.recordWorkflowCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      workflowName: "prospect-workflow",
      entityType: "prospect",
      entityId: "pros_1",
      step: "researched",
      status: "succeeded",
    }));
    expect(state.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "signal",
      entityId: "sig_1",
      eventName: "SignalCaptured",
    }));
  });

  it("dispatches lifecycle work through the actor-backed dispatcher when provided", async () => {
    const repository = {
      ensureDefaultCampaign: vi.fn(async () => ({ id: "cmp_default" })),
      getControlFlags: vi.fn(async () => ({
        globalKillSwitch: false,
        noSendsMode: false,
        pausedCampaignIds: [],
      })),
      recordProviderRun: vi.fn(async () => "run_1"),
      insertSignal: vi.fn(async () => "sig_1"),
      appendAuditEvent: vi.fn(async () => undefined),
      pauseThread: vi.fn(async () => undefined),
      createOrUpdateProspectFromSignal: vi.fn(async () => ({ prospectId: "pros_1", threadId: "thr_1" })),
      updateProviderRun: vi.fn(async () => undefined),
    };
    const state = {
      recordSignal: vi.fn(async () => ({
        providerId: "convex",
        stateSignalId: "state_sig_1",
        stored: true,
      })),
      recordWorkflowCheckpoint: vi.fn(async () => ({
        providerId: "convex",
        checkpointId: "chk_1",
        stored: true,
      })),
      appendAuditEvent: vi.fn(async () => ({
        providerId: "convex",
        auditEventId: "aud_1",
        stored: true,
      })),
    };
    const dispatchProspectLifecycle = vi.fn(async ({ prospectId }: { prospectId: string }) => ({
      action: "researched" as const,
      prospectId,
      threadId: "thr_1",
      reason: "actor-dispatched",
    }));

    const result = await ingestSignalWebhook(
      {
        context: {
          repository,
          state,
        },
        runSandboxTurn: vi.fn(),
        dispatchProspectLifecycle,
      } as any,
      {
        provider: "custom-source",
        source: "reddit_post",
        signal: {
          url: "https://reddit.com/r/example/post",
          authorName: "Casey",
          authorTitle: "Growth Operator",
          authorCompany: "Launch Labs",
          companyDomain: "launchlabs.io",
          topic: "signal-based GTM",
          content: "We are rebuilding our outbound workflow stack.",
        },
      },
    );

    expect(dispatchProspectLifecycle).toHaveBeenCalledWith({
      prospectId: "pros_1",
    });
    expect(result).toMatchObject({
      ok: true,
      results: [
        expect.objectContaining({
          prospectsProcessed: 1,
        }),
      ],
    });
  });

  it("accepts signals but defers new prospect work while the campaign is paused", async () => {
    const repository = {
      ensureDefaultCampaign: vi.fn(async () => ({ id: "cmp_default" })),
      getControlFlags: vi.fn(async () => ({
        globalKillSwitch: false,
        noSendsMode: false,
        pausedCampaignIds: ["cmp_default"],
      })),
      recordProviderRun: vi.fn(async () => "run_1"),
      insertSignal: vi.fn(async () => "sig_1"),
      appendAuditEvent: vi.fn(async () => undefined),
      pauseThread: vi.fn(async () => undefined),
      createOrUpdateProspectFromSignal: vi.fn(async () => ({ prospectId: "pros_1", threadId: "thr_1" })),
      updateProviderRun: vi.fn(async () => undefined),
    };
    const state = {
      recordSignal: vi.fn(async () => ({
        providerId: "convex",
        stateSignalId: "state_sig_1",
        stored: true,
      })),
      recordWorkflowCheckpoint: vi.fn(async () => ({
        providerId: "convex",
        checkpointId: "chk_1",
        stored: true,
      })),
      appendAuditEvent: vi.fn(async () => ({
        providerId: "convex",
        auditEventId: "aud_1",
        stored: true,
      })),
    };

    const result = await ingestSignalWebhook(
      {
        context: {
          repository,
          state,
        },
        runSandboxTurn: vi.fn(),
      } as any,
      {
        provider: "custom-source",
        source: "reddit_post",
        signal: {
          url: "https://reddit.com/r/example/post",
          authorName: "Casey",
          authorTitle: "Growth Operator",
          authorCompany: "Launch Labs",
          companyDomain: "launchlabs.io",
          topic: "signal-based GTM",
          content: "We are rebuilding our outbound workflow stack.",
        },
      },
    );

    expect(repository.createOrUpdateProspectFromSignal).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      signalsReceived: 1,
      results: [
        expect.objectContaining({
          prospectsProcessed: 0,
          deferredSignals: [
            expect.objectContaining({
              signalId: "sig_1",
              reason: "campaign is paused",
            }),
          ],
        }),
      ],
    });
    expect(state.recordWorkflowCheckpoint).toHaveBeenCalledWith(expect.objectContaining({
      workflowName: "signal-ingest",
      entityType: "signal",
      entityId: "sig_1",
      step: "deferred",
      status: "succeeded",
    }));
  });

  it("pauses the thread when the prospect workflow throws after signal capture", async () => {
    vi.mocked(executeProspectWorkflow).mockRejectedValueOnce(new Error("knowledge path missing"));

    const repository = {
      ensureDefaultCampaign: vi.fn(async () => ({ id: "cmp_default" })),
      getControlFlags: vi.fn(async () => ({
        globalKillSwitch: false,
        noSendsMode: false,
        pausedCampaignIds: [],
      })),
      recordProviderRun: vi.fn(async () => "run_1"),
      insertSignal: vi.fn(async () => "sig_1"),
      appendAuditEvent: vi.fn(async () => undefined),
      pauseThread: vi.fn(async () => undefined),
      createOrUpdateProspectFromSignal: vi.fn(async () => ({ prospectId: "pros_1", threadId: "thr_1" })),
      updateProviderRun: vi.fn(async () => undefined),
    };
    const state = {
      recordSignal: vi.fn(async () => ({
        providerId: "convex",
        stateSignalId: "state_sig_1",
        stored: true,
      })),
      recordWorkflowCheckpoint: vi.fn(async () => ({
        providerId: "convex",
        checkpointId: "chk_1",
        stored: true,
      })),
      appendAuditEvent: vi.fn(async () => ({
        providerId: "convex",
        auditEventId: "aud_1",
        stored: true,
      })),
    };

    const result = await ingestSignalWebhook(
      {
        context: {
          repository,
          state,
        },
        runSandboxTurn: vi.fn(),
      } as any,
      {
        provider: "custom-source",
        source: "reddit_post",
        signal: {
          url: "https://reddit.com/r/example/post",
          authorName: "Casey",
          authorTitle: "Growth Operator",
          authorCompany: "Launch Labs",
          companyDomain: "launchlabs.io",
          topic: "signal-based GTM",
          content: "We are rebuilding our outbound workflow stack.",
        },
      },
    );

    expect(repository.pauseThread).toHaveBeenCalledWith("thr_1", "workflow failed: knowledge path missing");
    expect(repository.appendAuditEvent).toHaveBeenCalledWith("thread", "thr_1", "ThreadPaused", {
      reason: "workflow failed: knowledge path missing",
    });
    expect(result).toMatchObject({
      ok: true,
      results: [
        expect.objectContaining({
          prospectsProcessed: 0,
          workflowFailures: [
            expect.objectContaining({
              signalId: "sig_1",
              prospectId: "pros_1",
              error: "knowledge path missing",
            }),
          ],
        }),
      ],
    });
  });
});
