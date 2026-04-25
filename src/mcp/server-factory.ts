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
    "lead.inspect",
    {
      description: "Get a concise operator report for one prospect, including qualification, research, thread state, and recent events.",
      inputSchema: {
        prospectId: z.string(),
        eventLimit: z.number().int().min(1).max(25).optional(),
      },
    },
    async ({ prospectId, eventLimit }) =>
      toToolResult(await context.mcpTools.handleTool("lead.inspect", { prospectId, eventLimit })),
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
    "crm.syncProspect",
    {
      description: "Sync one prospect into the configured CRM provider. Today this writes to Attio when configured.",
      inputSchema: {
        prospectId: z.string(),
        createNote: z.boolean().optional(),
        addToList: z.boolean().optional(),
        listStage: z.string().optional(),
      },
    },
    async ({ prospectId, createNote, addToList, listStage }) =>
      toToolResult(await context.mcpTools.handleTool("crm.syncProspect", { prospectId, createNote, addToList, listStage })),
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
    "pipeline.summary",
    {
      description: "Get a concise operator summary of the SDR pipeline, including discovery state and current throughput.",
      inputSchema: {
        limit: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.handleTool("pipeline.summary", { limit })),
  );

  server.registerTool(
    "pipeline.activeThreads",
    {
      description: "List currently active prospect threads with stage, qualification summary, and LinkedIn URL.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.handleTool("pipeline.activeThreads", { limit })),
  );

  server.registerTool(
    "pipeline.qualifiedLeads",
    {
      description: "List qualified leads with qualification reasoning, research confidence, and email availability.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.handleTool("pipeline.qualifiedLeads", { limit })),
  );

  server.registerTool(
    "pipeline.providerRuns",
    {
      description: "List recent provider runs such as Apify and enrichment activity, including failures and request terms.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.handleTool("pipeline.providerRuns", { limit })),
  );

  server.registerTool(
    "pipeline.failures",
    {
      description: "Summarize recent provider failures, sandbox failures, operational blocks, and qualification rejections.",
      inputSchema: {
        providerLimit: z.number().int().min(1).max(100).optional(),
        prospectLimit: z.number().int().min(1).max(100).optional(),
        sandboxLimit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ providerLimit, prospectLimit, sandboxLimit }) =>
      toToolResult(
        await context.mcpTools.handleTool("pipeline.failures", {
          providerLimit,
          prospectLimit,
          sandboxLimit,
        }),
      ),
  );

  server.registerTool(
    "pipeline.workflowFeed",
    {
      description: "List the latest normalized internal workflow events across signals, prospects, and threads.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.handleTool("pipeline.workflowFeed", { limit })),
  );

  server.registerTool(
    "runtime.discovery",
    {
      description: "Inspect one discovery actor, including term frontier, recent runs, and source-local state.",
      inputSchema: {
        source: z.enum(["linkedin_public_post", "x_public_post"]).optional(),
      },
    },
    async ({ source }) => toToolResult(await context.mcpTools.handleTool("runtime.discovery", { source })),
  );

  server.registerTool(
    "runtime.discoveryHealth",
    {
      description: "Get a summarized health view of discovery sources instead of full raw actor snapshots.",
      inputSchema: {},
    },
    async () => toToolResult(await context.mcpTools.handleTool("runtime.discoveryHealth", {})),
  );

  server.registerTool(
    "runtime.sandboxJobs",
    {
      description: "Inspect queued, running, and recent sandbox jobs with durations and errors.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    async ({ limit }) => toToolResult(await context.mcpTools.handleTool("runtime.sandboxJobs", { limit })),
  );

  server.registerTool(
    "runtime.flags",
    {
      description: "Inspect campaign flags, no-sends mode, and kill-switch state.",
      inputSchema: {},
    },
    async () => toToolResult(await context.mcpTools.handleTool("runtime.flags", {})),
  );

  server.registerTool(
    "thread.inspect",
    {
      description: "Get a concise operator report for one thread, including the bound prospect context and recent events.",
      inputSchema: {
        threadId: z.string(),
        eventLimit: z.number().int().min(1).max(25).optional(),
      },
    },
    async ({ threadId, eventLimit }) =>
      toToolResult(await context.mcpTools.handleTool("thread.inspect", { threadId, eventLimit })),
  );

  server.registerTool(
    "thread.resume",
    {
      description: "Resume a paused thread and clear its paused reason so it can send or continue processing.",
      inputSchema: {
        threadId: z.string(),
        stage: z.string().optional(),
        reason: z.string().optional(),
      },
    },
    async ({ threadId, stage, reason }) =>
      toToolResult(await context.mcpTools.handleTool("thread.resume", { threadId, stage, reason })),
  );

  server.registerTool(
    "control.runDiscovery",
    {
      description: "Safely enqueue a discovery tick for one source.",
      inputSchema: {
        source: z.enum(["linkedin_public_post", "x_public_post"]).optional(),
        reason: z.string().optional(),
      },
    },
    async ({ source, reason }) => toToolResult(await context.mcpTools.handleTool("control.runDiscovery", { source, reason })),
  );

  server.registerTool(
    "control.setNoSendsMode",
    {
      description: "Enable or disable no-sends mode through the campaignOps actor.",
      inputSchema: {
        enabled: z.boolean(),
      },
    },
    async ({ enabled }) => toToolResult(await context.mcpTools.handleTool("control.setNoSendsMode", { enabled })),
  );

  server.registerTool(
    "control.setCampaignTimezone",
    {
      description: "Set the IANA timezone used for campaign-local quiet hours.",
      inputSchema: {
        campaignId: z.string().optional(),
        timezone: z.string(),
      },
    },
    async ({ campaignId, timezone }) =>
      toToolResult(await context.mcpTools.handleTool("control.setCampaignTimezone", { campaignId, timezone })),
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
    "mail.preview",
    {
      description: "Generate the next outbound or reply draft using the sandbox, without sending anything.",
      inputSchema: {
        threadId: z.string(),
        kind: z.enum(["first_outbound", "follow_up", "reply"]).optional(),
      },
    },
    async (args) => toToolResult(await context.mcpTools.handleTool("mail.preview", args)),
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
