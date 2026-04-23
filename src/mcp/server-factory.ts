import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { AppContext } from "../services/runtime-context.js";

function toToolResult(result: unknown) {
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  const structuredContent =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { result };
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    structuredContent,
  };
}

export function createOrchidMcpServer(context: AppContext) {
  const server = new McpServer({
    name: "orchid-sdr",
    version: "0.1.0",
  });

  server.registerTool(
    "knowledge.search",
    {
      description: "Search the Orchid repo-managed ICP, product, compliance, and handoff docs.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().min(1).max(10).optional(),
      },
    },
    async ({ query, limit }) => toToolResult(await context.mcpTools.handleTool("knowledge.search", { query, limit })),
  );

  server.registerTool(
    "lead.getContext",
    {
      description: "Get the current normalized prospect, thread, message, email, and research context.",
      inputSchema: {
        prospectId: z.string(),
      },
    },
    async ({ prospectId }) => toToolResult(await context.mcpTools.handleTool("lead.getContext", { prospectId })),
  );

  server.registerTool(
    "lead.updateState",
    {
      description: "Update lead/prospect stage or reply state.",
      inputSchema: {
        prospectId: z.string(),
        stage: z.string().optional(),
        status: z.string().optional(),
        lastReplyClass: z.string().optional(),
        pausedReason: z.string().nullable().optional(),
      },
    },
    async (args) => toToolResult(await context.mcpTools.handleTool("lead.updateState", args)),
  );

  server.registerTool(
    "email.enrich",
    {
      description: "Find and save the best work email for the prospect.",
      inputSchema: {
        prospectId: z.string(),
      },
    },
    async ({ prospectId }) => toToolResult(await context.mcpTools.handleTool("email.enrich", { prospectId })),
  );

  server.registerTool(
    "research.search",
    {
      description: "Run broad web research using the configured research provider.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().min(1).max(10).optional(),
      },
    },
    async ({ query, limit }) => toToolResult(await context.mcpTools.handleTool("research.search", { query, limit })),
  );

  server.registerTool(
    "research.extract",
    {
      description: "Extract markdown from a specific URL using the configured extraction provider.",
      inputSchema: {
        url: z.string().url(),
      },
    },
    async ({ url }) => toToolResult(await context.mcpTools.handleTool("research.extract", { url })),
  );

  server.registerTool(
    "mail.send",
    {
      description: "Send the first outbound or a follow-up after deterministic policy checks.",
      inputSchema: {
        threadId: z.string(),
        kind: z.string().optional(),
        subject: z.string(),
        bodyText: z.string(),
      },
    },
    async (args) => toToolResult(await context.mcpTools.handleTool("mail.send", args)),
  );

  server.registerTool(
    "mail.reply",
    {
      description: "Reply on an existing thread after deterministic policy checks.",
      inputSchema: {
        threadId: z.string(),
        subject: z.string(),
        bodyText: z.string(),
      },
    },
    async (args) => toToolResult(await context.mcpTools.handleTool("mail.reply", args)),
  );

  server.registerTool(
    "mail.pause",
    {
      description: "Pause a thread and prevent further automated sends.",
      inputSchema: {
        threadId: z.string(),
        reason: z.string(),
      },
    },
    async ({ threadId, reason }) => toToolResult(await context.mcpTools.handleTool("mail.pause", { threadId, reason })),
  );

  server.registerTool(
    "handoff.slack",
    {
      description: "Send a Slack handoff and pause the thread.",
      inputSchema: {
        threadId: z.string(),
        reason: z.string(),
        payload: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ threadId, reason, payload }) =>
      toToolResult(await context.mcpTools.handleTool("handoff.slack", { threadId, reason, payload })),
  );

  server.registerTool(
    "handoff.webhook",
    {
      description: "Emit a machine-readable handoff webhook and pause the thread.",
      inputSchema: {
        threadId: z.string(),
        reason: z.string(),
        payload: z.record(z.string(), z.unknown()).optional(),
      },
    },
    async ({ threadId, reason, payload }) =>
      toToolResult(await context.mcpTools.handleTool("handoff.webhook", { threadId, reason, payload })),
  );

  return server;
}
