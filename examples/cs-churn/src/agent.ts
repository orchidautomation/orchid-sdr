import { trellis } from "@trellis/gtm";
import { accountArgs, churnBriefDraft, churnSchemas, churnTrace } from "./churn/agent-contract";
import { salesforceCrm, usageWarehouse, zendeskSupport } from "./integrations/providers";
import { csMcpSurface } from "./mcp/cs-surface";
import stateMap from "./state/customer-health.map";

export default trellis.agent("spring-health-cs-churn", {
  // Providers stay swappable: direct APIs, first-party MCP, or Composio-backed tools.
  crm: salesforceCrm(),
  sources: [zendeskSupport(), usageWarehouse()],
  mcp: csMcpSurface,
  model: "cloudflare/openai/gpt-5.5",
  state: stateMap,
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound({
    noSends: true,
    requireApproval: ["crm.update"],
  }),
}, async (app) => {
  const signal = await app.signal();
  const context = await app.context(signal);
  const account = accountArgs(signal);

  // The old `/churn-check` command becomes visible runtime orchestration:
  // gather evidence in parallel, score it, then draft the save plan.
  const [salesforce, zendesk, usage] = await Promise.all([
    app.skill("churn-salesforce", {
      context,
      args: account,
      schema: churnSchemas.evidenceSlice,
      trace: churnTrace.salesforce,
    }),
    app.skill("churn-zendesk", {
      context,
      args: account,
      schema: churnSchemas.evidenceSlice,
      trace: churnTrace.zendesk,
    }),
    app.skill("churn-usage", {
      context,
      args: account,
      schema: churnSchemas.evidenceSlice,
      trace: churnTrace.usage,
    }),
  ]);

  const score = await app.skill("churn-risk-score", {
    context,
    args: { ...account, salesforce, zendesk, usage },
    schema: churnSchemas.riskScore,
    trace: churnTrace.riskScore,
  });

  const savePlan = await app.skill("churn-playbook", {
    context,
    args: { ...account, score },
    schema: churnSchemas.playbook,
    trace: churnTrace.playbook,
  });

  // Workflow start persists the run, emits trace events, and queues the CRM update
  // for human approval instead of writing to Salesforce directly.
  return app.workflow("churn-assessment").start({
    signal,
    salesforce,
    zendesk,
    usage,
    score,
    playbook: savePlan,
    draft: churnBriefDraft({ accountName: account.accountName, score, savePlan }),
    approvalRequiredFor: ["crm.update"],
  });
});
