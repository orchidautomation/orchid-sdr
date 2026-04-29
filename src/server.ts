import { Hono } from "hono";

import { getAppContext } from "./services/runtime-context.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { registerDashboardRoutes } from "./http/dashboard.js";
import { registerMcpRoutes } from "./http/mcp.js";
import { registerRivetManagerRoutes } from "./http/rivet-manager.js";
import { registerWebhookRoutes } from "./http/webhooks.js";

export async function createApp() {
  const app = new Hono();
  const context = getAppContext();
  const workflowDeps = {
    context,
    runSandboxTurn: (request: Parameters<typeof runSandboxTurn>[1]) => runSandboxTurn(context, request),
  };

  registerDashboardRoutes(app, context);
  registerRivetManagerRoutes(app);
  registerMcpRoutes(app, context);
  registerWebhookRoutes(app, workflowDeps);

  return app;
}
