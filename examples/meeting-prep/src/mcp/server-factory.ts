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
    "meetings.list",
    {
      description: "List the most recent meeting bookings processed by this Trellis app.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.listMeetings(limit ?? 10)),
  );

  server.registerTool(
    "meetings.get",
    {
      description: "Get a meeting plus its attendees, prep run, and latest prep brief.",
      inputSchema: {
        meetingId: z.string(),
      },
    },
    async ({ meetingId }) => toToolResult(await context.mcpTools.getMeeting(meetingId)),
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
