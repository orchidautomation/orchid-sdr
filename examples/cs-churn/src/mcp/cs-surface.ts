import type { TrellisMcpConfig } from "@trellis/gtm";

const churnSkillInputSchema = {
  type: "object",
  required: ["accountName"],
  properties: {
    accountName: { type: "string" },
    accountId: { type: "string" },
  },
  additionalProperties: false,
};

export const csMcpSurface = {
  name: "trellis-cs-churn",
  operator: {
    name: "trellis-operator",
  },
  tools: {
    include: [
      "describe_agent",
      "estimate_cost",
      "list_pending_approvals",
      "approve_draft",
      "reject_draft",
      "inspect_churn_score",
      "draft_save_playbook",
    ],
    skillTools: [
      {
        name: "inspect_churn_score",
        skill: "churn-risk-score",
        description: "Score one account from supplied Salesforce, Zendesk, and usage evidence without starting the full workflow.",
        inputSchema: churnSkillInputSchema,
      },
      {
        name: "draft_save_playbook",
        skill: "churn-playbook",
        description: "Draft a save plan from an existing churn score without starting the full workflow.",
        inputSchema: churnSkillInputSchema,
      },
    ],
  },
} satisfies TrellisMcpConfig;
