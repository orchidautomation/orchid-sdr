import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface McpToolHandler {
  handleTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface DefaultSdrMcpContext {
  mcpTools: McpToolHandler;
}

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

function registerTool(
  server: McpServer,
  context: DefaultSdrMcpContext,
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>,
) {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
    },
    async (args) => toToolResult(await context.mcpTools.handleTool(name, args as Record<string, unknown>)),
  );
}

export function createDefaultSdrMcpServer(
  context: DefaultSdrMcpContext,
  input?: {
    name?: string;
    version?: string;
  },
) {
  const server = new McpServer({
    name: input?.name ?? "trellis",
    version: input?.version ?? "0.1.0",
  });

  registerTool(
    server,
    context,
    "knowledge.search",
    "Search the Trellis repo-managed ICP, product, compliance, and handoff docs.",
    {
      query: z.string(),
      limit: z.number().int().min(1).max(10).optional(),
    },
  );

  registerTool(
    server,
    context,
    "lead.getContext",
    "Get the current normalized prospect, thread, message, email, and research context.",
    {
      prospectId: z.string(),
    },
  );

  registerTool(
    server,
    context,
    "lead.inspect",
    "Get a concise operator report for one prospect, including qualification, research, thread state, and recent events.",
    {
      prospectId: z.string(),
      eventLimit: z.number().int().min(1).max(25).optional(),
    },
  );

  registerTool(
    server,
    context,
    "lead.updateState",
    "Update lead/prospect stage or reply state.",
    {
      prospectId: z.string(),
      stage: z.string().optional(),
      status: z.string().optional(),
      lastReplyClass: z.string().optional(),
      pausedReason: z.string().nullable().optional(),
    },
  );

  registerTool(
    server,
    context,
    "crm.syncProspect",
    "Sync one prospect into the configured CRM provider. Today this writes to Attio when configured.",
    {
      prospectId: z.string(),
      createNote: z.boolean().optional(),
      addToList: z.boolean().optional(),
      listStage: z.string().optional(),
    },
  );

  registerTool(
    server,
    context,
    "email.enrich",
    "Find and save the best work email for the prospect.",
    {
      prospectId: z.string(),
    },
  );

  registerTool(
    server,
    context,
    "research.search",
    "Run broad web research using the configured research provider.",
    {
      query: z.string(),
      limit: z.number().int().min(1).max(10).optional(),
    },
  );

  registerTool(
    server,
    context,
    "research.extract",
    "Extract markdown from a specific URL using the configured extraction provider.",
    {
      url: z.string().url(),
    },
  );

  registerTool(
    server,
    context,
    "pipeline.summary",
    "Get a concise operator summary of the SDR pipeline, including discovery state and current throughput.",
    {
      limit: z.number().int().min(1).max(20).optional(),
    },
  );

  registerTool(
    server,
    context,
    "pipeline.activeThreads",
    "List currently active prospect threads with stage, qualification summary, and LinkedIn URL.",
    {
      limit: z.number().int().min(1).max(50).optional(),
    },
  );

  registerTool(
    server,
    context,
    "pipeline.qualifiedLeads",
    "List qualified leads with qualification reasoning, research confidence, and email availability.",
    {
      limit: z.number().int().min(1).max(50).optional(),
    },
  );

  registerTool(
    server,
    context,
    "pipeline.providerRuns",
    "List recent provider runs such as Apify and enrichment activity, including failures and request terms.",
    {
      limit: z.number().int().min(1).max(50).optional(),
    },
  );

  registerTool(
    server,
    context,
    "pipeline.failures",
    "Summarize recent provider failures, sandbox failures, operational blocks, and qualification rejections.",
    {
      providerLimit: z.number().int().min(1).max(100).optional(),
      prospectLimit: z.number().int().min(1).max(100).optional(),
      sandboxLimit: z.number().int().min(1).max(100).optional(),
    },
  );

  registerTool(
    server,
    context,
    "pipeline.workflowFeed",
    "List the latest normalized internal workflow events across signals, prospects, and threads.",
    {
      limit: z.number().int().min(1).max(100).optional(),
    },
  );

  registerTool(
    server,
    context,
    "runtime.discovery",
    "Inspect one discovery actor, including term frontier, recent runs, and source-local state.",
    {
      source: z.enum(["linkedin_public_post", "x_public_post"]).optional(),
    },
  );

  registerTool(
    server,
    context,
    "runtime.discoveryHealth",
    "Get a summarized health view of discovery sources instead of full raw actor snapshots.",
    {},
  );

  registerTool(
    server,
    context,
    "runtime.sandboxJobs",
    "Inspect queued, running, and recent sandbox jobs with durations and errors.",
    {
      limit: z.number().int().min(1).max(100).optional(),
    },
  );

  registerTool(
    server,
    context,
    "runtime.flags",
    "Inspect campaign flags, no-sends mode, and kill-switch state.",
    {},
  );

  registerTool(
    server,
    context,
    "thread.inspect",
    "Get a concise operator report for one thread, including the bound prospect context and recent events.",
    {
      threadId: z.string(),
      eventLimit: z.number().int().min(1).max(25).optional(),
    },
  );

  registerTool(
    server,
    context,
    "thread.resume",
    "Resume a paused thread and clear its paused reason so it can send or continue processing.",
    {
      threadId: z.string(),
      stage: z.string().optional(),
      reason: z.string().optional(),
    },
  );

  registerTool(
    server,
    context,
    "control.runDiscovery",
    "Safely enqueue a discovery tick for one source.",
    {
      source: z.enum(["linkedin_public_post", "x_public_post"]).optional(),
      reason: z.string().optional(),
    },
  );

  registerTool(
    server,
    context,
    "control.setNoSendsMode",
    "Enable or disable no-sends mode through the campaignOps actor.",
    {
      enabled: z.boolean(),
    },
  );

  registerTool(
    server,
    context,
    "control.setCampaignTimezone",
    "Set the IANA timezone used for campaign-local quiet hours.",
    {
      campaignId: z.string().optional(),
      timezone: z.string(),
    },
  );

  registerTool(
    server,
    context,
    "mail.send",
    "Send the first outbound or a follow-up after deterministic policy checks.",
    {
      threadId: z.string(),
      kind: z.string().optional(),
      subject: z.string(),
      bodyText: z.string(),
    },
  );

  registerTool(
    server,
    context,
    "mail.preview",
    "Generate the next outbound or reply draft using the sandbox, without sending anything.",
    {
      threadId: z.string(),
      kind: z.enum(["first_outbound", "follow_up", "reply"]).optional(),
    },
  );

  registerTool(
    server,
    context,
    "mail.reply",
    "Reply on an existing thread after deterministic policy checks.",
    {
      threadId: z.string(),
      subject: z.string(),
      bodyText: z.string(),
    },
  );

  registerTool(
    server,
    context,
    "mail.pause",
    "Pause a thread and prevent further automated sends.",
    {
      threadId: z.string(),
      reason: z.string(),
    },
  );

  registerTool(
    server,
    context,
    "handoff.slack",
    "Send a Slack handoff and pause the thread.",
    {
      threadId: z.string(),
      reason: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    },
  );

  registerTool(
    server,
    context,
    "handoff.webhook",
    "Emit a machine-readable handoff webhook and pause the thread.",
    {
      threadId: z.string(),
      reason: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    },
  );

  return server;
}
