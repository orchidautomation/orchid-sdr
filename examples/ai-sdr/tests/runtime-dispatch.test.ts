import { describe, expect, it, vi } from "vitest";

import {
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
});
