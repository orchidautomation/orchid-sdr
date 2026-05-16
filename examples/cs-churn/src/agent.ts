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
  const signal = await app.signal();
  const context = await app.context(signal);
  const account = accountFromSignal(signal);

  // Step 1: collect evidence from CRM, support, and usage systems.
  const evidence = await steps.collectAccountEvidence.run(app, { context, account });

  // Step 2: score churn risk using only the evidence from Step 1.
  const score = await steps.scoreChurnRisk.run(app, {
    context,
    args: { ...account, ...evidence },
  });

  // Step 3: recommend a concrete save plan for the CSM team.
  const savePlan = await steps.recommendSavePlan.run(app, {
    context,
    args: { ...account, score },
  });

  // Step 4: record the run and wait for approval before any CRM write.
  return app.workflow("churn-assessment").start({
    signal,
    ...evidence,
    score,
    playbook: savePlan,
    draft: churnBriefDraft({ accountName: account.accountName, score, savePlan }),
    approvalRequiredFor: approvalGates.churnAssessment,
  });
});
