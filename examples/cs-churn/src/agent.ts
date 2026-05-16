import { trellis } from "@trellis/gtm";
import { salesforceCrm, usageWarehouse, zendeskSupport } from "./integrations/providers";
import { csMcpSurface } from "./mcp/cs-surface";
import stateMap from "./state/customer-health.map";
import {
  accountFromSignal,
  approvalGates,
  churnBriefDraft,
  defineApprovalStep,
  defineSkillStep,
  runSkillStep,
} from "./steps";

const evidenceSteps = {
  salesforce: defineSkillStep({
    phase: "Evidence Phase 1A",
    name: "Read Salesforce account evidence",
    skill: "churn-salesforce",
    agentTools: ["crm.readAccount", "crm.query", "optional Composio Salesforce toolkit"],
    operatorTools: [],
    produces: "CRM evidence about renewal, sponsor, QBR, and health status",
    outputSchema: "evidence",
    observability: {
      parent: "churn-assessment",
      phase: "gather",
      sequence: 1,
      label: "Salesforce CRM evidence",
    },
  }),

  zendesk: defineSkillStep({
    phase: "Evidence Phase 1B",
    name: "Read Zendesk support evidence",
    skill: "churn-zendesk",
    agentTools: ["support.ticket.search", "support.ticket.read", "optional Composio Zendesk toolkit"],
    operatorTools: [],
    produces: "support evidence about volume, escalations, themes, SLA, and CSAT",
    outputSchema: "evidence",
    observability: {
      parent: "churn-assessment",
      phase: "gather",
      sequence: 2,
      label: "Zendesk support evidence",
    },
  }),

  usage: defineSkillStep({
    phase: "Evidence Phase 1C",
    name: "Read product usage evidence",
    skill: "churn-usage",
    agentTools: ["usage.query", "Snowflake/Postgres/read-only warehouse"],
    operatorTools: [],
    produces: "usage evidence about registration, utilization, admin cadence, and activity",
    outputSchema: "evidence",
    observability: {
      parent: "churn-assessment",
      phase: "gather",
      sequence: 3,
      label: "Usage telemetry evidence",
    },
  }),
};

const churnAssessmentPath = {
  scoreRisk: defineSkillStep({
    phase: "Churn Phase 2",
    name: "Score churn risk",
    skill: "churn-risk-score",
    agentTools: ["Salesforce evidence", "Zendesk evidence", "usage evidence"],
    operatorTools: ["inspect_churn_score"],
    produces: "Red/Orange/Yellow/Green churn score",
    outputSchema: "riskScore",
    observability: {
      parent: "churn-assessment",
      phase: "score",
      sequence: 4,
      dependsOn: ["churn-salesforce", "churn-zendesk", "churn-usage"],
      label: "Score churn risk",
    },
  }),

  recommendSavePlan: defineSkillStep({
    phase: "Churn Phase 3",
    name: "Recommend a save plan",
    skill: "churn-playbook",
    agentTools: ["risk score", "account context"],
    operatorTools: ["draft_save_playbook", "list_pending_approvals", "approve_draft"],
    produces: "CSM save plan with owner, persona, timeframe, and next action",
    outputSchema: "playbook",
    observability: {
      parent: "churn-assessment",
      phase: "recommend",
      sequence: 5,
      dependsOn: ["churn-risk-score"],
      label: "Recommend save plan",
    },
  }),

  queueCrmUpdate: defineApprovalStep({
    phase: "Churn Phase 4",
    name: "Queue CRM update approval",
    agentTools: ["crm.update"],
    operatorTools: ["list_pending_approvals", "approve_draft", "reject_draft"],
    produces: "human-reviewable account health and save-plan CRM update",
    approvalGate: approvalGates.churnAssessment,
  }),
};

export default trellis.agent("spring-health-cs-churn", {
  // Runtime capabilities the agent can use while doing CS work.
  crm: salesforceCrm(),
  sources: [zendeskSupport(), usageWarehouse()],

  // Human/operator surface available through MCP clients.
  mcp: csMcpSurface,

  // Runtime shape: model route, mounted knowledge, mounted skills, state, safety.
  model: "cloudflare/openai/gpt-5.5",
  state: stateMap,
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound({
    noSends: true,
    requireApproval: churnAssessmentPath.queueCrmUpdate.approvalGate,
  }),
}, async (app) => {
  // A signal is the incoming work item, usually an account-health review request.
  const signal = await app.signal();

  // Context loads the agent's knowledge, thread history, state, and capabilities.
  const context = await app.context(signal);
  const account = accountFromSignal(signal);

  const [salesforce, zendesk, usage] = await Promise.all([
    runSkillStep(app, evidenceSteps.salesforce, { context, args: account }),
    runSkillStep(app, evidenceSteps.zendesk, { context, args: account }),
    runSkillStep(app, evidenceSteps.usage, { context, args: account }),
  ]);

  const score = await runSkillStep(app, churnAssessmentPath.scoreRisk, {
    context,
    args: { ...account, salesforce, zendesk, usage },
  });

  const savePlan = await runSkillStep(app, churnAssessmentPath.recommendSavePlan, {
    context,
    args: { ...account, score },
  });

  return app.workflow("churn-assessment").start({
    signal,
    salesforce,
    zendesk,
    usage,
    score,
    playbook: savePlan,
    draft: churnBriefDraft({ accountName: account.accountName, score, savePlan }),
    approvalRequiredFor: churnAssessmentPath.queueCrmUpdate.approvalGate,
  });
});
