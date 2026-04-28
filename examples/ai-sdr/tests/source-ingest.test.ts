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
      recordProviderRun: vi.fn(async () => "run_1"),
      insertSignal: vi.fn(async () => "sig_1"),
      appendAuditEvent: vi.fn(async () => undefined),
      createOrUpdateProspectFromSignal: vi.fn(async () => ({ prospectId: "pros_1" })),
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
});
