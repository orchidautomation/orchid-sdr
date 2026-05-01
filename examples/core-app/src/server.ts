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
import { mountDefaultSdrDashboardRoutes, mountDefaultSdrMcpHttpRoute, mountDefaultSdrRuntimeRoutes } from "../../../packages/default-sdr/src/http-routes.js";
import { hashDashboardPassword } from "../../../packages/default-sdr/src/dashboard-bootstrap.js";
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

    const actor = actorClient.workItemThread.getOrCreate([captured.result.workItemId]) as any;
    await actor.bootstrapFromWebhook({
      workItemId: captured.result.workItemId,
      eventId: captured.result.eventId,
    });

    return c.json({
      ok: true,
      workItemId: captured.result.workItemId,
      eventId: captured.result.eventId,
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
