import type { TrellisGtmApp, TrellisSignal, TrellisSkillTraceContext } from "@trellis/gtm";
import { z } from "zod";

type AccountArgs = {
  accountName: string;
  accountId?: string;
};

type StepRunInput = {
  context: Record<string, unknown>;
  args: Record<string, unknown>;
};

type StepDefinition = {
  skill: string;
  agent_tools: string[];
  operator_tools?: string[];
  produces: string;
  schema: z.ZodTypeAny;
  observability?: TrellisSkillTraceContext;
};

const evidence = z.object({
  summary: z.string().min(1),
  flags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  dataFreshness: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

const riskScore = z.object({
  score: z.number().min(0).max(100),
  band: z.enum(["Green", "Yellow", "Orange", "Red"]),
  topDrivers: z.array(z.object({
    driver: z.string(),
    evidence: z.string(),
    weight: z.number(),
  })).default([]),
  mitigants: z.array(z.string()).default([]),
  confidence: z.enum(["High", "Medium", "Low"]),
  math: z.string().optional(),
});

const playbook = z.object({
  headline: z.string().min(1),
  highestLeverageAction: z.string().min(1),
  actions: z.array(z.object({
    owner: z.string(),
    persona: z.string(),
    timeframe: z.string(),
    action: z.string(),
    definitionOfDone: z.string(),
  })).max(6),
  stopDoing: z.array(z.string()).default([]),
});

function skillStep(definition: StepDefinition) {
  return {
    ...definition,
    run(app: TrellisGtmApp, input: StepRunInput) {
      return app.skill(definition.skill, {
        context: input.context,
        args: input.args,
        schema: definition.schema,
        trace: definition.observability,
      });
    },
  };
}

const salesforceEvidence = skillStep({
  skill: "churn-salesforce",
  agent_tools: ["crm.readAccount", "crm.query", "optional Composio Salesforce toolkit"],
  operator_tools: [],
  produces: "CRM evidence about renewal, sponsor, QBR, and health status",
  schema: evidence,
  observability: {
    parent: "churn-assessment",
    phase: "gather",
    sequence: 1,
    label: "Salesforce CRM evidence",
  },
});

const zendeskEvidence = skillStep({
  skill: "churn-zendesk",
  agent_tools: ["support.ticket.search", "support.ticket.read", "optional Composio Zendesk toolkit"],
  operator_tools: [],
  produces: "support evidence about volume, escalations, themes, SLA, and CSAT",
  schema: evidence,
  observability: {
    parent: "churn-assessment",
    phase: "gather",
    sequence: 2,
    label: "Zendesk support evidence",
  },
});

const usageEvidence = skillStep({
  skill: "churn-usage",
  agent_tools: ["usage.query", "Snowflake/Postgres/read-only warehouse"],
  operator_tools: [],
  produces: "usage evidence about registration, utilization, admin cadence, and activity",
  schema: evidence,
  observability: {
    parent: "churn-assessment",
    phase: "gather",
    sequence: 3,
    label: "Usage telemetry evidence",
  },
});

export const steps = {
  salesforceEvidence,
  zendeskEvidence,
  usageEvidence,

  scoreChurnRisk: skillStep({
    skill: "churn-risk-score",
    agent_tools: ["Salesforce evidence", "Zendesk evidence", "usage evidence"],
    operator_tools: ["inspect_churn_score"],
    produces: "Red/Orange/Yellow/Green churn score",
    schema: riskScore,
    observability: {
      parent: "churn-assessment",
      phase: "score",
      sequence: 4,
      dependsOn: ["churn-salesforce", "churn-zendesk", "churn-usage"],
      label: "Score churn risk",
    },
  }),

  recommendSavePlan: skillStep({
    skill: "churn-playbook",
    agent_tools: ["risk score", "account context"],
    operator_tools: ["draft_save_playbook", "list_pending_approvals", "approve_draft"],
    produces: "CSM save plan with owner, persona, timeframe, and next action",
    schema: playbook,
    observability: {
      parent: "churn-assessment",
      phase: "recommend",
      sequence: 5,
      dependsOn: ["churn-risk-score"],
      label: "Recommend save plan",
    },
  }),
};

export const approvalGates = {
  churnAssessment: ["crm.update"],
};

export function accountFromSignal(signal: TrellisSignal): AccountArgs {
  return {
    accountName: String(signal.payload?.accountName ?? signal.payload?.account ?? "Unknown account"),
    accountId: typeof signal.payload?.accountId === "string" ? signal.payload.accountId : undefined,
  };
}

export function churnBriefDraft(input: { accountName: string; score: unknown; savePlan: unknown }) {
  return {
    subject: `Churn risk brief: ${input.accountName}`,
    body: JSON.stringify({
      accountName: input.accountName,
      score: input.score,
      savePlan: input.savePlan,
    }, null, 2),
  };
}
