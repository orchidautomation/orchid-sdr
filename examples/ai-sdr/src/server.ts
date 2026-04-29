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
  handleAgentMailWebhook,
  handleHandoffWebhook,
  handleSignalWebhook,
} from "./orchestration/webhook-handlers.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { getAutomationPauseReason } from "./orchestration/workflow-control.js";
import {
  createDashboardStateController,
  getDashboardPassword as resolveDashboardPassword,
} from "../../../packages/default-sdr/src/dashboard-bootstrap.js";
import {
  buildDefaultSdrDashboardCoreState,
  buildDefaultSdrDashboardRuntimeState,
} from "../../../packages/default-sdr/src/dashboard-state.js";
import {
  mountDefaultSdrDashboardRoutes,
  mountDefaultSdrMcpHttpRoute,
  mountDefaultSdrRuntimeRoutes,
} from "../../../packages/default-sdr/src/http-routes.js";
import {
  buildDefaultSdrStandardDashboardActions,
  mountDefaultSdrDashboardActionRoutes,
} from "../../../packages/default-sdr/src/dashboard-actions.js";
import { mountDefaultSdrWebhookRoutes } from "../../../packages/default-sdr/src/webhook-bootstrap.js";
import type { DefaultSdrDashboardActorClient } from "../../../packages/default-sdr/src/dashboard-state.js";

export function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const dashboardCookieName = "trellis_dashboard_auth";
  const dashboardState = createDashboardStateController({
    buildCoreState: () => buildDefaultSdrDashboardCoreState(context),
    buildRuntimeState: () =>
      buildDefaultSdrDashboardRuntimeState(context, {
        getActorClient: () => getActorClient() as unknown as DefaultSdrDashboardActorClient,
      }),
  });

  const workflowDeps = {
    context,
    runSandboxTurn: (request: Parameters<typeof runSandboxTurn>[1]) => runSandboxTurn(context, request),
  };

  const dashboardRoutes = mountDefaultSdrDashboardRoutes(app, {
    dashboardCookieName,
    getPassword: () => getDashboardPassword(context),
    renderLoginPage: renderDashboardLoginPage,
    renderDashboardPage,
    dashboardState,
  });

  mountDefaultSdrRuntimeRoutes(app, {
    ensureRuntimeBootstrapped,
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

  mountDefaultSdrDashboardActionRoutes(app, {
    requireAuth: dashboardRoutes.requireAuth,
    actions: buildDefaultSdrStandardDashboardActions({
      localSmokeMode: context.localSmokeMode,
      discoveryLinkedinEnabled: context.config.DISCOVERY_LINKEDIN_ENABLED,
      discoveryXEnabled: context.config.DISCOVERY_X_ENABLED,
      ensureDefaultCampaign: () => context.repository.ensureDefaultCampaign(),
      getControlFlags: () => context.repository.getControlFlags(),
      getAutomationPauseReason: (controlFlags, campaignId) => getAutomationPauseReason(controlFlags as any, campaignId),
      getActorClient: () => getActorClient() as any,
      buildSandboxProbeRequest: ({ campaignId }) => ({
        turnId: `dashboard-firecrawl-probe-${Date.now()}`,
        prospectId: "dashboard",
        campaignId,
        stage: "build_research_brief",
        systemPrompt: "Use available tools when needed. Keep the final answer to one short line.",
        prompt: "Use the Firecrawl MCP server to inspect https://playkit.sh and reply with the page title only.",
        metadata: {
          kind: "dashboard-firecrawl-probe",
        },
      }),
    }),
  });

  mountDefaultSdrMcpHttpRoute(app, {
    bearerToken: context.config.mcpToken,
    createServer: () => createTrellisMcpServer(context),
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
      onApifyRunCompleted: async (payload) => {
        const client = getActorClient();
        const actor = client.discoveryCoordinator.getOrCreate([payload.campaignId, payload.source]) as any;
        return actor.handleApifyRunCompleted(payload);
      },
      onSignal: async (payload) => handleSignalWebhook(workflowDeps, payload),
      onAgentMail: async (payload) => handleAgentMailWebhook(workflowDeps, payload),
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
