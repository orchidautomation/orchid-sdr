export interface DefaultSdrProspectLifecycleDispatchClient<Outcome = unknown> {
  prospectThread: {
    getOrCreate(key: [string]): {
      runLifecycle(input: {
        prospectId: string;
        forceFollowup?: boolean;
      }): Promise<Outcome>;
    };
  };
}

export interface DefaultSdrDiscoveryCompletionClient<Result = unknown> {
  discoveryCoordinator: {
    getOrCreate(key: [string, "linkedin_public_post" | "x_public_post"]): {
      handleApifyRunCompleted(payload: {
        actorRunId: string;
        source: "linkedin_public_post" | "x_public_post";
        campaignId: string;
        term?: string | null;
        defaultDatasetId?: string | null;
        metadata?: Record<string, unknown>;
      }): Promise<Result>;
    };
  };
}

export function createActorBackedProspectLifecycleDispatcher<Outcome = unknown>(
  client: DefaultSdrProspectLifecycleDispatchClient<Outcome>,
) {
  return async (input: {
    prospectId: string;
    forceFollowup?: boolean;
  }) => {
    const actor = client.prospectThread.getOrCreate([input.prospectId]);
    return actor.runLifecycle({
      prospectId: input.prospectId,
      forceFollowup: input.forceFollowup,
    });
  };
}

export function createActorBackedDiscoveryCompletionHandler<Result = unknown>(
  client: DefaultSdrDiscoveryCompletionClient<Result>,
) {
  return (payload: {
    actorRunId: string;
    source: "linkedin_public_post" | "x_public_post";
    campaignId: string;
    term?: string | null;
    defaultDatasetId?: string | null;
    metadata?: Record<string, unknown>;
  }) => {
    const actor = client.discoveryCoordinator.getOrCreate([payload.campaignId, payload.source]);
    return actor.handleApifyRunCompleted(payload);
  };
}
