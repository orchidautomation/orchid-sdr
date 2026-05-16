import { trellis } from "@trellis/gtm";
import { salesforceCrm, usageWarehouse, zendeskSupport } from "./integrations/providers";
import { csMcpSurface } from "./mcp/cs-surface";
import stateMap from "./state/customer-health.map";
import { accountFromSignal, approvalGates, churnBriefDraft, steps } from "./steps";

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
    requireApproval: approvalGates.churnAssessment,
  }),
}, async (app) => {
  // A signal is the incoming work item, usually an account-health review request.
  const signal = await app.signal();

  // Context loads the agent's knowledge, thread history, state, and capabilities.
  const context = await app.context(signal);
  const account = accountFromSignal(signal);

  // Step 1: collect account evidence in parallel.
  // Each skill reads one system and returns a small, redacted evidence object.
  const [salesforce, zendesk, usage] = await Promise.all([
    // Skill: churn-salesforce
    // Uses: crm.readAccount, crm.query, optional Composio Salesforce toolkit
    // Related MCP: none yet; this is a runtime-only evidence step.
    // Output schema: evidence in src/steps.ts
    steps.salesforceEvidence.run(app, { context, args: account }),

    // Skill: churn-zendesk
    // Uses: support.ticket.search, support.ticket.read, optional Composio Zendesk toolkit
    // Related MCP: none yet; this is a runtime-only evidence step.
    // Output schema: evidence in src/steps.ts
    steps.zendeskEvidence.run(app, { context, args: account }),

    // Skill: churn-usage
    // Uses: usage.query, Snowflake/Postgres/read-only warehouse
    // Related MCP: none yet; this is a runtime-only evidence step.
    // Output schema: evidence in src/steps.ts
    steps.usageEvidence.run(app, { context, args: account }),
  ]);

  // Step 2: score churn risk using only the evidence from Step 1.
  // Skill: churn-risk-score
  // Uses: Salesforce evidence, Zendesk evidence, usage evidence
  // Related MCP: inspect_churn_score
  // Output schema: riskScore in src/steps.ts
  const score = await steps.scoreChurnRisk.run(app, {
    context,
    args: { ...account, salesforce, zendesk, usage },
  });

  // Step 3: recommend a concrete save plan for the CSM team.
  // Skill: churn-playbook
  // Uses: risk score, account context
  // Related MCP: draft_save_playbook, list_pending_approvals, approve_draft
  // Output schema: playbook in src/steps.ts
  const savePlan = await steps.recommendSavePlan.run(app, {
    context,
    args: { ...account, score },
  });

  // Step 4: record the run and wait for approval before any CRM write.
  // Approval gate: crm.update
  // Related MCP: list_pending_approvals, approve_draft, reject_draft
  return app.workflow("churn-assessment").start({
    signal,
    salesforce,
    zendesk,
    usage,
    score,
    playbook: savePlan,
    draft: churnBriefDraft({ accountName: account.accountName, score, savePlan }),
    approvalRequiredFor: approvalGates.churnAssessment,
  });
});
