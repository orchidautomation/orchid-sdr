import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AppContext } from "../services/runtime-context.js";

function toToolResult(result: unknown) {
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  const structuredContent =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { result };
  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

export function createTrellisMcpServer(context: AppContext) {
  const server = new McpServer({
    name: "trellis",
    version: "0.1.0",
  });

  server.registerTool(
    "work.list",
    {
      description: "List the most recent Trellis work items.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.listWorkItems(limit ?? 10)),
  );

  server.registerTool(
    "work.get",
    {
      description: "Get a work item plus its latest artifact and event trail.",
      inputSchema: {
        workItemId: z.string(),
      },
    },
    async ({ workItemId }) => toToolResult(await context.mcpTools.getWorkItem(workItemId)),
  );

  server.registerTool(
    "knowledge.search",
    {
      description: "Search repo-managed knowledge files.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().min(1).max(10).optional(),
      },
    },
    async ({ query, limit }) => toToolResult(await context.mcpTools.searchKnowledge(query, limit ?? 5)),
  );

  return server;
}

