export interface DefaultSdrProspectLifecycleDispatchClient<Outcome = unknown> {
  prospectThread: {
    getOrCreate(key: [string]): {
      runLifecycle(input: {
        prospectId: string;
        forceFollowup?: boolean;
      }): Promise<Outcome>;
      handleInboundReply?(input: {
        providerInboxId?: string | null;
        providerThreadId: string;
        providerMessageId?: string | null;
        subject?: string | null;
        bodyText: string;
        rawPayload?: Record<string, unknown>;
      }): Promise<Outcome | null>;
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

export function buildDefaultSdrActorBackedWorkflowDependencies<
  Context,
  SandboxTurnRequest,
  SandboxTurnResponse,
  Outcome = unknown,
>(input: {
  context: Context;
  actorClient: DefaultSdrProspectLifecycleDispatchClient<Outcome>;
  runSandboxTurn(
    context: Context,
    request: SandboxTurnRequest,
  ): Promise<SandboxTurnResponse>;
}) {
  return {
    context: input.context,
    runSandboxTurn: (request: SandboxTurnRequest) =>
      input.runSandboxTurn(input.context, request),
    dispatchProspectLifecycle: createActorBackedProspectLifecycleDispatcher(input.actorClient),
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

export function createActorBackedInboundReplyHandler<Outcome = unknown>(
  client: DefaultSdrProspectLifecycleDispatchClient<Outcome>,
  input: {
    resolveProspectIdByProviderThreadId(providerThreadId: string): Promise<string | null>;
  },
) {
  return async (payload: {
    providerInboxId?: string | null;
    providerThreadId: string;
    providerMessageId?: string | null;
    subject?: string | null;
    bodyText: string;
    rawPayload?: Record<string, unknown>;
  }) => {
    const prospectId = await input.resolveProspectIdByProviderThreadId(payload.providerThreadId);
    if (!prospectId) {
      return null;
    }

    const actor = client.prospectThread.getOrCreate([prospectId]);
    if (!actor.handleInboundReply) {
      throw new Error("prospectThread.handleInboundReply is not available on the actor client");
    }

    return actor.handleInboundReply(payload);
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
