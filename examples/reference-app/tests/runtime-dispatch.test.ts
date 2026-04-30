import { describe, expect, it, vi } from "vitest";

import {
  buildDefaultSdrActorBackedWorkflowDependencies,
  createActorBackedInboundReplyHandler,
  createActorBackedDiscoveryCompletionHandler,
  createActorBackedProspectLifecycleDispatcher,
} from "../../../packages/default-sdr/src/runtime-dispatch.js";

describe("runtime dispatch helpers", () => {
  it("routes prospect lifecycle work to the prospect thread actor keyed by prospect id", async () => {
    const runLifecycle = vi.fn(async (input: { prospectId: string }) => ({
      action: "researched",
      prospectId: input.prospectId,
      threadId: "thr_1",
    }));
    const getOrCreate = vi.fn(() => ({ runLifecycle }));

    const dispatch = createActorBackedProspectLifecycleDispatcher({
      prospectThread: {
        getOrCreate,
      },
    });

    const result = await dispatch({
      prospectId: "pros_1",
    });

    expect(getOrCreate).toHaveBeenCalledWith(["pros_1"]);
    expect(runLifecycle).toHaveBeenCalledWith({
      prospectId: "pros_1",
      forceFollowup: undefined,
    });
    expect(result).toMatchObject({
      action: "researched",
      prospectId: "pros_1",
    });
  });

  it("routes Apify completion payloads to the keyed discovery coordinator", async () => {
    const handleApifyRunCompleted = vi.fn(async () => ({ ok: true }));
    const getOrCreate = vi.fn(() => ({ handleApifyRunCompleted }));

    const handleCompletion = createActorBackedDiscoveryCompletionHandler({
      discoveryCoordinator: {
        getOrCreate,
      },
    });

    const payload = {
      actorRunId: "run_1",
      source: "linkedin_public_post" as const,
      campaignId: "cmp_default",
      term: "revops",
    };

    await handleCompletion(payload);

    expect(getOrCreate).toHaveBeenCalledWith(["cmp_default", "linkedin_public_post"]);
    expect(handleApifyRunCompleted).toHaveBeenCalledWith(payload);
  });

  it("builds actor-backed workflow dependencies from context, actor client, and sandbox runner", async () => {
    const runLifecycle = vi.fn(async (input: { prospectId: string; forceFollowup?: boolean }) => ({
      action: "researched",
      prospectId: input.prospectId,
      threadId: "thr_1",
    }));
    const sandboxRunner = vi.fn(async (_context: { id: string }, request: { turnId: string }) => ({
      turnId: request.turnId,
      outputText: "ok",
      transcript: [],
    }));
    const context = { id: "ctx_1" };

    const deps = buildDefaultSdrActorBackedWorkflowDependencies({
      context,
      actorClient: {
        prospectThread: {
          getOrCreate: vi.fn(() => ({ runLifecycle })),
        },
      },
      runSandboxTurn: sandboxRunner,
    });

    const turn = await deps.runSandboxTurn({
      turnId: "turn_1",
    });
    const outcome = await deps.dispatchProspectLifecycle({
      prospectId: "pros_1",
      forceFollowup: true,
    });

    expect(turn).toMatchObject({
      turnId: "turn_1",
      outputText: "ok",
    });
    expect(sandboxRunner).toHaveBeenCalledWith(context, {
      turnId: "turn_1",
    });
    expect(runLifecycle).toHaveBeenCalledWith({
      prospectId: "pros_1",
      forceFollowup: true,
    });
    expect(outcome).toMatchObject({
      action: "researched",
      prospectId: "pros_1",
    });
  });

  it("routes inbound replies through the prospect thread actor resolved from provider thread id", async () => {
    const runLifecycle = vi.fn(async () => ({
      action: "researched",
      prospectId: "pros_1",
      threadId: "thr_1",
      reason: "noop",
    }));
    const handleInboundReply = vi.fn(async (input: { providerThreadId: string }) => ({
      action: "replied",
      prospectId: "pros_1",
      threadId: "thr_1",
      reason: input.providerThreadId,
    }));
    const getOrCreate = vi.fn(() => ({ runLifecycle, handleInboundReply }));
    const resolveProspectIdByProviderThreadId = vi.fn(async (providerThreadId: string) =>
      providerThreadId === "provider_thr_1" ? "pros_1" : null,
    );

    const dispatch = createActorBackedInboundReplyHandler(
      {
        prospectThread: {
          getOrCreate,
        },
      },
      {
        resolveProspectIdByProviderThreadId,
      },
    );

    const result = await dispatch({
      providerThreadId: "provider_thr_1",
      bodyText: "yes",
    });

    expect(resolveProspectIdByProviderThreadId).toHaveBeenCalledWith("provider_thr_1");
    expect(getOrCreate).toHaveBeenCalledWith(["pros_1"]);
    expect(handleInboundReply).toHaveBeenCalledWith({
      providerThreadId: "provider_thr_1",
      bodyText: "yes",
    });
    expect(result).toMatchObject({
      action: "replied",
      prospectId: "pros_1",
      threadId: "thr_1",
    });
  });
});
