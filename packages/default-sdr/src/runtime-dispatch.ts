import type { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createDashboardStateController } from "./dashboard-bootstrap.js";
import {
  buildDefaultSdrDashboardCoreState,
  buildDefaultSdrDashboardRuntimeState,
  type DefaultSdrDashboardActorClient,
  type DefaultSdrDashboardStateContext,
} from "./dashboard-state.js";
import {
  type DefaultSdrDashboardStateController,
  mountDefaultSdrDashboardRoutes,
  mountDefaultSdrMcpHttpRoute,
  mountDefaultSdrRuntimeRoutes,
} from "./http-routes.js";
import {
  buildDefaultSdrStandardDashboardActions,
  buildDefaultSdrPageTitleSandboxProbeRequest,
  mountDefaultSdrDashboardActionRoutes,
  type DefaultSdrStandardDashboardActorClient,
} from "./dashboard-actions.js";

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

export function buildDefaultSdrActorBackedWebhookHandlers<
  ProspectOutcome = unknown,
  DiscoveryOutcome = unknown,
>(input: {
  actorClient: DefaultSdrProspectLifecycleDispatchClient<ProspectOutcome>
    & DefaultSdrDiscoveryCompletionClient<DiscoveryOutcome>;
  resolveProspectIdByProviderThreadId(providerThreadId: string): Promise<string | null>;
}) {
  return {
    onApifyRunCompleted: createActorBackedDiscoveryCompletionHandler(input.actorClient),
    onAgentMail: createActorBackedInboundReplyHandler(input.actorClient, {
      resolveProspectIdByProviderThreadId: input.resolveProspectIdByProviderThreadId,
    }),
  };
}

export function mountDefaultSdrActorBackedOperatorSurface<
  Context extends DefaultSdrDashboardStateContext,
  ActorClient extends DefaultSdrDashboardActorClient & DefaultSdrStandardDashboardActorClient,
>(app: Hono, input: {
  context: Context;
  actorClient: ActorClient;
  dashboardCookieName: string;
  getPassword(): string;
  renderLoginPage(input?: { error?: string }): string;
  renderDashboardPage(): string;
  mcpBearerToken: string;
  ensureRuntimeBootstrapped(): Promise<void>;
  shouldUseRemoteRivetRuntime(): boolean;
  shouldSkipLocalRivetRuntime(): boolean;
  handleRemoteRivetRequest(request: Request): Promise<Response>;
  createMcpServer(): {
    connect(transport: WebStandardStreamableHTTPServerTransport): Promise<void>;
    close(): Promise<void>;
  };
  localSmokeMode: boolean;
  getAutomationPauseReason(controlFlags: unknown, campaignId: string): string | null;
  buildSandboxProbeRequest?(input: { campaignId: string }): {
    turnId: string;
    prospectId: string;
    campaignId: string;
    stage: string;
    systemPrompt: string;
    prompt: string;
    metadata?: Record<string, unknown>;
  };
  getHealth(): Promise<{
    ok: true;
    service: string;
    localSmokeMode: boolean;
  }>;
}) {
  const dashboardState = createDashboardStateController({
    buildCoreState: () => buildDefaultSdrDashboardCoreState(input.context),
    buildRuntimeState: () =>
      buildDefaultSdrDashboardRuntimeState(input.context, {
        getActorClient: () => input.actorClient,
      }),
  });

  const dashboardRoutes = mountDefaultSdrDashboardRoutes(app, {
    dashboardCookieName: input.dashboardCookieName,
    getPassword: input.getPassword,
    renderLoginPage: input.renderLoginPage,
    renderDashboardPage: input.renderDashboardPage,
    dashboardState,
  });

  mountDefaultSdrRuntimeRoutes(app, {
    ensureRuntimeBootstrapped: input.ensureRuntimeBootstrapped,
    shouldUseRemoteRivetRuntime: input.shouldUseRemoteRivetRuntime,
    shouldSkipLocalRivetRuntime: input.shouldSkipLocalRivetRuntime,
    handleRemoteRivetRequest: input.handleRemoteRivetRequest,
    getHealth: input.getHealth,
  });

  mountDefaultSdrDashboardActionRoutes(app, {
    requireAuth: dashboardRoutes.requireAuth,
    actions: buildDefaultSdrStandardDashboardActions({
      localSmokeMode: input.localSmokeMode,
      discoveryLinkedinEnabled: input.context.config.DISCOVERY_LINKEDIN_ENABLED,
      discoveryXEnabled: input.context.config.DISCOVERY_X_ENABLED,
      ensureDefaultCampaign: () => input.context.repository.ensureDefaultCampaign(),
      getControlFlags: () => input.context.repository.getControlFlags(),
      getAutomationPauseReason: input.getAutomationPauseReason,
      getActorClient: () => input.actorClient,
      buildSandboxProbeRequest: input.buildSandboxProbeRequest
        ?? (({ campaignId }) =>
          buildDefaultSdrPageTitleSandboxProbeRequest({
            campaignId,
            url: "https://playkit.sh",
            mcpServerName: "Firecrawl",
            metadataKind: "dashboard-firecrawl-probe",
          })),
    }),
  });

  mountDefaultSdrMcpHttpRoute(app, {
    bearerToken: input.mcpBearerToken,
    createServer: input.createMcpServer,
  });

  return {
    dashboardState,
    dashboardRoutes,
  } satisfies {
    dashboardState: DefaultSdrDashboardStateController;
    dashboardRoutes: ReturnType<typeof mountDefaultSdrDashboardRoutes>;
  };
}
