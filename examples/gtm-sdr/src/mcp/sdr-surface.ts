import { schema, type TrellisMcpConfig } from "@trellis/gtm";

const sdrTools = [
  "describe_agent",
  "list_leads",
  "get_lead",
  "pipeline_stats",
  "estimate_cost",
  "list_pending_approvals",
  "approve_draft",
  "reject_draft",
  "edit_and_approve_draft",
  "list_handoffs",
  "list_replies",
  "research_account",
  "qualify_lead",
  "draft_email",
];

const boundedSkillTools = [
  {
    name: "qualify_lead",
    skill: "icp-qualification",
    description: "Run the qualification skill without starting the full workflow.",
    schema: schema.qualification(),
  },
  {
    name: "draft_email",
    skill: "sdr-copy",
    description: "Run the outbound copy skill without starting the full workflow.",
    schema: schema.outboundDraft(),
  },
];

export const sdrMcpSurface = {
  name: "trellis-sdr",
  surface: "sdr",
  operator: {
    name: "trellis-operator",
  },
  tools: {
    include: sdrTools,
    skillTools: boundedSkillTools,
  },
} satisfies TrellisMcpConfig;
