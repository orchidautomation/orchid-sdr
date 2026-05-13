import { Hono } from "hono";

import { renderDashboardLoginPage, renderDashboardPage } from "./dashboard/page.js";
import { registry } from "./registry.js";
import { getAppContext } from "./services/runtime-context.js";
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
import { executeMeetingPrepWorkflow } from "./orchestration/work-item-workflow.js";
import { handleMeetingBookingWebhook } from "./orchestration/webhook-handlers.js";

export function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const dashboardCookieName = "trellis_dashboard_auth";
  const dashboardState = new DashboardStateService(context);
  const intakePath = context.framework.config.webhooks?.[0]?.path ?? "/webhooks/meetings";

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
        service: "trellis-meeting-prep",
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
    const captured = await handleMeetingBookingWebhook(context, c.req.raw);
    if (captured instanceof Response) {
      return captured;
    }

    await executeMeetingPrepWorkflow(context, captured.result.meetingId);

    return c.json({
      ok: true,
      meetingId: captured.result.meetingId,
      prepRunId: captured.result.prepRunId,
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
