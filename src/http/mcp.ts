import type { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createOrchidMcpServer } from "../mcp/server-factory.js";
import type { AppContext } from "../services/runtime-context.js";

export function registerMcpRoutes(app: Hono, context: AppContext) {
  app.all("/mcp/orchid-sdr", async (c) => {
    const authorization = c.req.header("authorization");
    if (authorization !== `Bearer ${context.config.mcpToken}`) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const server = createOrchidMcpServer(context);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      await server.close();
    }
  });
}
