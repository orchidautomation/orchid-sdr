import { Hono } from "hono";

import { renderDashboardLoginPage, renderDashboardPage } from "./dashboard/page.js";
import { registry } from "./registry.js";
import { getAppContext } from "./services/runtime-context.js";
import { getActorClient } from "./services/actor-client.js";
import {
  ensureRuntimeBootstrapped,
  shouldSkipLocalRivetRuntime,
  shouldUseRemoteRivetRuntime,
} from "./services/runtime-bootstrap.js";
import { createTrellisMcpServer } from "./mcp/server-factory.js";
import {
  handleHandoffWebhook,
  handleSignalWebhook,
} from "./orchestration/webhook-handlers.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { getAutomationPauseReason } from "./orchestration/workflow-control.js";
import {
  getDashboardPassword as resolveDashboardPassword,
} from "../../../packages/default-sdr/src/dashboard-bootstrap.js";
import {
  buildDefaultSdrActorBackedWorkflowDependencies,
  buildDefaultSdrActorBackedWebhookHandlers,
  mountDefaultSdrActorBackedOperatorSurface,
} from "../../../packages/default-sdr/src/runtime-dispatch.js";
import { mountDefaultSdrWebhookRoutes } from "../../../packages/default-sdr/src/webhook-bootstrap.js";
import type { WorkflowDependencies } from "./orchestration/types.js";

export function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const actorClient = getActorClient();
  const dashboardCookieName = "trellis_dashboard_auth";

  const workflowDeps: WorkflowDependencies = buildDefaultSdrActorBackedWorkflowDependencies({
    context,
    actorClient: actorClient as any,
    runSandboxTurn,
  }) as WorkflowDependencies;
  const actorBackedWebhookHandlers = buildDefaultSdrActorBackedWebhookHandlers({
    actorClient: actorClient as any,
    resolveProspectIdByProviderThreadId: async (providerThreadId) =>
      (await context.repository.getProspectIdByProviderThreadId(providerThreadId))?.prospectId ?? null,
  });

  const { dashboardRoutes } = mountDefaultSdrActorBackedOperatorSurface(app, {
    context,
    actorClient: actorClient as any,
    dashboardCookieName,
    getPassword: () => getDashboardPassword(context),
    renderLoginPage: renderDashboardLoginPage,
    renderDashboardPage,
    mcpBearerToken: context.config.mcpToken,
    ensureRuntimeBootstrapped,
    localSmokeMode: context.localSmokeMode,
    getAutomationPauseReason: (controlFlags, campaignId) => getAutomationPauseReason(controlFlags as any, campaignId),
    createMcpServer: () => createTrellisMcpServer(context),
    shouldUseRemoteRivetRuntime,
    shouldSkipLocalRivetRuntime,
    handleRemoteRivetRequest: (request) => registry.handler(request),
    getHealth: async () => {
      await context.repository.ensureDefaultCampaign();
      return {
        ok: true,
        service: "trellis",
        localSmokeMode: context.localSmokeMode,
      };
    },
  });

  mountDefaultSdrWebhookRoutes(app, {
    context: {
      config: {
        APIFY_WEBHOOK_SECRET: context.config.APIFY_WEBHOOK_SECRET ?? "",
        SIGNAL_WEBHOOK_SECRET: context.config.SIGNAL_WEBHOOK_SECRET,
      },
      repository: context.repository,
      security: {
        verifySharedSecretHeader: context.security.verifySharedSecretHeader,
        verifyAgentMailWebhook: (rawBody, headers) => context.security.verifyAgentMailWebhook(rawBody, headers as any),
        verifyHandoffSignature: context.security.verifyHandoffSignature,
      },
      providers: context.providers,
    },
    handlers: {
      onApifyRunCompleted: actorBackedWebhookHandlers.onApifyRunCompleted,
      onSignal: async (payload) => handleSignalWebhook(workflowDeps, payload),
      onAgentMail: async (payload) => {
        if (!payload.threadId || !payload.bodyText) {
          return {
            ok: true,
            ignored: true,
            reason: "threadId or bodyText missing",
          };
        }

        return actorBackedWebhookHandlers.onAgentMail({
          providerInboxId: payload.inboxId ?? null,
          providerThreadId: payload.threadId,
          providerMessageId: payload.messageId ?? null,
          subject: payload.subject ?? null,
          bodyText: payload.bodyText,
          rawPayload: payload.payload ?? {},
        });
      },
      onHandoff: async (payload) => handleHandoffWebhook(workflowDeps, payload),
    },
  });

  return app;
}

export default createApp();

function getDashboardPassword(context: ReturnType<typeof getAppContext>) {
  return resolveDashboardPassword({
    dashboardPassword: context.config.DASHBOARD_PASSWORD,
    sandboxToken: context.config.TRELLIS_SANDBOX_TOKEN,
  });
}
