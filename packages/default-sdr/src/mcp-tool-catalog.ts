import { z } from "zod";

export interface DefaultSdrMcpToolDefinition {
  name: string;
  description: string;
  group:
    | "knowledge"
    | "lead"
    | "crm"
    | "email"
    | "research"
    | "pipeline"
    | "runtime"
    | "thread"
    | "control"
    | "mail"
    | "handoff";
  inputSchema: Record<string, z.ZodTypeAny>;
}

export interface DefaultSdrMcpToolSelection {
  toolGroups?: string[];
  includeTools?: string[];
  excludeTools?: string[];
}

export const defaultSdrMcpToolCatalog: DefaultSdrMcpToolDefinition[] = [
  {
    name: "knowledge.search",
    group: "knowledge",
    description: "Search the Trellis repo-managed ICP, product, compliance, and handoff docs.",
    inputSchema: {
      query: z.string(),
      limit: z.number().int().min(1).max(10).optional(),
    },
  },
  {
    name: "lead.getContext",
    group: "lead",
    description: "Get the current normalized prospect, thread, message, email, and research context.",
    inputSchema: {
      prospectId: z.string(),
    },
  },
  {
    name: "lead.inspect",
    group: "lead",
    description: "Get a concise operator report for one prospect, including qualification, research, thread state, and recent events.",
    inputSchema: {
      prospectId: z.string(),
      eventLimit: z.number().int().min(1).max(25).optional(),
    },
  },
  {
    name: "lead.updateState",
    group: "lead",
    description: "Update lead/prospect stage or reply state.",
    inputSchema: {
      prospectId: z.string(),
      stage: z.string().optional(),
      status: z.string().optional(),
      lastReplyClass: z.string().optional(),
      pausedReason: z.string().nullable().optional(),
    },
  },
  {
    name: "crm.syncProspect",
    group: "crm",
    description: "Sync one prospect into the configured CRM provider. Today this writes to Attio when configured.",
    inputSchema: {
      prospectId: z.string(),
      createNote: z.boolean().optional(),
      addToList: z.boolean().optional(),
      listStage: z.string().optional(),
    },
  },
  {
    name: "enrich.email",
    group: "email",
    description: "Find and save the best work email for the prospect.",
    inputSchema: {
      prospectId: z.string(),
    },
  },
  {
    name: "research.search",
    group: "research",
    description: "Run broad web research using the configured research provider.",
    inputSchema: {
      query: z.string(),
      limit: z.number().int().min(1).max(10).optional(),
    },
  },
  {
    name: "research.extract",
    group: "research",
    description: "Extract markdown from a specific URL using the configured extraction provider.",
    inputSchema: {
      url: z.string().url(),
    },
  },
  {
    name: "pipeline.summary",
    group: "pipeline",
    description: "Get a concise operator summary of the SDR pipeline, including discovery state and current throughput.",
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional(),
    },
  },
  {
    name: "pipeline.activeThreads",
    group: "pipeline",
    description: "List currently active prospect threads with stage, qualification summary, and LinkedIn URL.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  {
    name: "pipeline.qualifiedLeads",
    group: "pipeline",
    description: "List qualified leads with qualification reasoning, research confidence, and email availability.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  {
    name: "pipeline.providerRuns",
    group: "pipeline",
    description: "List recent provider runs such as Apify and enrichment activity, including failures and request terms.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  {
    name: "pipeline.failures",
    group: "pipeline",
    description: "Summarize recent provider failures, sandbox failures, operational blocks, and qualification rejections.",
    inputSchema: {
      providerLimit: z.number().int().min(1).max(100).optional(),
      prospectLimit: z.number().int().min(1).max(100).optional(),
      sandboxLimit: z.number().int().min(1).max(100).optional(),
    },
  },
  {
    name: "pipeline.workflowFeed",
    group: "pipeline",
    description: "List the latest normalized internal workflow events across signals, prospects, and threads.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  {
    name: "runtime.discovery",
    group: "runtime",
    description: "Inspect one discovery actor, including term frontier, recent runs, and source-local state.",
    inputSchema: {
      source: z.enum(["linkedin_public_post", "x_public_post"]).optional(),
    },
  },
  {
    name: "runtime.discoveryHealth",
    group: "runtime",
    description: "Get a summarized health view of discovery sources instead of full raw actor snapshots.",
    inputSchema: {},
  },
  {
    name: "runtime.sandboxJobs",
    group: "runtime",
    description: "Inspect queued, running, and recent sandbox jobs with durations and errors.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  {
    name: "runtime.flags",
    group: "runtime",
    description: "Inspect campaign flags, no-sends mode, and kill-switch state.",
    inputSchema: {},
  },
  {
    name: "thread.inspect",
    group: "thread",
    description: "Get a concise operator report for one thread, including the bound prospect context and recent events.",
    inputSchema: {
      threadId: z.string(),
      eventLimit: z.number().int().min(1).max(25).optional(),
    },
  },
  {
    name: "thread.resume",
    group: "thread",
    description: "Resume a paused thread and clear its paused reason so it can send or continue processing.",
    inputSchema: {
      threadId: z.string(),
      stage: z.string().optional(),
      reason: z.string().optional(),
    },
  },
  {
    name: "control.runDiscovery",
    group: "control",
    description: "Safely enqueue a discovery tick for one source.",
    inputSchema: {
      source: z.enum(["linkedin_public_post", "x_public_post"]).optional(),
      reason: z.string().optional(),
    },
  },
  {
    name: "control.setNoSendsMode",
    group: "control",
    description: "Enable or disable no-sends mode through the campaignOps actor.",
    inputSchema: {
      enabled: z.boolean(),
    },
  },
  {
    name: "control.setCampaignTimezone",
    group: "control",
    description: "Set the IANA timezone used for campaign-local quiet hours.",
    inputSchema: {
      campaignId: z.string().optional(),
      timezone: z.string(),
    },
  },
  {
    name: "email.send",
    group: "email",
    description: "Send the first outbound or a follow-up after deterministic policy checks.",
    inputSchema: {
      threadId: z.string(),
      kind: z.string().optional(),
      subject: z.string(),
      bodyText: z.string(),
    },
  },
  {
    name: "email.preview",
    group: "email",
    description: "Generate the next outbound or reply draft using the sandbox, without sending anything.",
    inputSchema: {
      threadId: z.string(),
      kind: z.enum(["first_outbound", "follow_up", "reply"]).optional(),
    },
  },
  {
    name: "email.reply",
    group: "email",
    description: "Reply on an existing thread after deterministic policy checks.",
    inputSchema: {
      threadId: z.string(),
      subject: z.string(),
      bodyText: z.string(),
    },
  },
  {
    name: "email.pause",
    group: "email",
    description: "Pause a thread and prevent further automated sends.",
    inputSchema: {
      threadId: z.string(),
      reason: z.string(),
    },
  },
  {
    name: "handoff.slack",
    group: "handoff",
    description: "Send a Slack handoff and pause the thread.",
    inputSchema: {
      threadId: z.string(),
      reason: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    },
  },
  {
    name: "handoff.webhook",
    group: "handoff",
    description: "Emit a machine-readable handoff webhook and pause the thread.",
    inputSchema: {
      threadId: z.string(),
      reason: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    },
  },
];

export function listDefaultSdrMcpToolNames() {
  return defaultSdrMcpToolCatalog.map((tool) => tool.name);
}

export function listDefaultSdrMcpToolGroups() {
  return [...new Set(defaultSdrMcpToolCatalog.map((tool) => tool.group))];
}

export function selectDefaultSdrMcpTools(selection?: DefaultSdrMcpToolSelection) {
  const allowedGroups = selection?.toolGroups ? new Set(selection.toolGroups) : null;
  const includeTools = new Set(selection?.includeTools ?? []);
  const excludeTools = new Set(selection?.excludeTools ?? []);

  return defaultSdrMcpToolCatalog.filter((tool) => {
    if (excludeTools.has(tool.name)) {
      return false;
    }

    if (includeTools.has(tool.name)) {
      return true;
    }

    if (!allowedGroups) {
      return true;
    }

    return allowedGroups.has(tool.group);
  });
}
