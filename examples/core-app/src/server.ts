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
  hashDashboardPassword,
  mountDefaultSdrDashboardRoutes,
  mountDefaultSdrMcpHttpRoute,
  mountDefaultSdrRuntimeRoutes,
} from "@trellis/default-sdr";
import { DashboardStateService } from "./services/dashboard-state.js";
import { handleIntakeWebhook } from "./orchestration/webhook-handlers.js";

export function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const actorClient = getActorClient();
  const dashboardCookieName = "trellis_dashboard_auth";
  const dashboardState = new DashboardStateService(context);
  const intakePath = context.framework.config.webhooks?.[0]?.path ?? "/webhooks/intake";

  mountDefaultSdrRuntimeRoutes(app, {
    ensureRuntimeBootstrapped,
    shouldUseRemoteRivetRuntime,
    shouldSkipLocalRivetRuntime,
    handleRemoteRivetRequest: (request) => registry.handler(request),
    rootRedirectTo: "/dashboard",
    getHealth: async () => {
      await context.repository.ensureWorkspace();
      return {
        ok: true,
        service: "trellis-core",
      };
    },
  });

  mountDefaultSdrDashboardRoutes(app, {
    dashboardCookieName,
    getPassword: () => context.config.DASHBOARD_PASSWORD ?? context.config.TRELLIS_SANDBOX_TOKEN,
    renderLoginPage: renderDashboardLoginPage,
    renderDashboardPage,
    dashboardState,
  });

  mountDefaultSdrMcpHttpRoute(app, {
    bearerToken: context.config.mcpToken,
    createServer: () => createTrellisMcpServer(context),
  });

  app.post(intakePath, async (c) => {
    const captured = await handleIntakeWebhook(context, c.req.raw);
    if (captured instanceof Response) {
      return captured;
    }

    const actor = actorClient.intakeEventThread.getOrCreate([captured.result.intakeEventId]) as any;
    await actor.bootstrapFromWebhook({
      intakeEventId: captured.result.intakeEventId,
      workflowRunId: captured.result.workflowRunId,
    });

    return c.json({
      ok: true,
      intakeEventId: captured.result.intakeEventId,
      workflowRunId: captured.result.workflowRunId,
    });
  });

  app.get("/api/dashboard/hash", (c) =>
    c.json({
      cookieName: dashboardCookieName,
      hash: hashDashboardPassword(context.config.DASHBOARD_PASSWORD ?? context.config.TRELLIS_SANDBOX_TOKEN),
    }),
  );

  return app;
}

export default createApp;
