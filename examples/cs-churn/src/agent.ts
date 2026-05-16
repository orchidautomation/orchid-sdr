import { trellis } from "@trellis/gtm";
import { z } from "zod";
import { csMcpSurface } from "./mcp/cs-surface";
import { salesforceCrm, usageWarehouse, zendeskSupport } from "./integrations/providers";
import stateMap from "./state/customer-health.map";

const evidenceSlice = z.object({
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

export default trellis.agent("spring-health-cs-churn", {
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
  const accountName = String(signal.payload?.accountName ?? signal.payload?.account ?? "Unknown account");
  const accountId = typeof signal.payload?.accountId === "string" ? signal.payload.accountId : undefined;
  const baseArgs = { accountName, accountId };

  // The Claude `/churn-check` command becomes visible runtime orchestration here:
  // gather three evidence slices in parallel, score them, then draft the save plan.
  const [salesforce, zendesk, usage] = await Promise.all([
    app.skill("churn-salesforce", {
      context,
      args: baseArgs,
      schema: evidenceSlice,
      trace: {
        parent: "churn-assessment",
        phase: "gather",
        sequence: 1,
        label: "Salesforce CRM slice",
      },
    }),
    app.skill("churn-zendesk", {
      context,
      args: baseArgs,
      schema: evidenceSlice,
      trace: {
        parent: "churn-assessment",
        phase: "gather",
        sequence: 2,
        label: "Zendesk support slice",
      },
    }),
    app.skill("churn-usage", {
      context,
      args: baseArgs,
      schema: evidenceSlice,
      trace: {
        parent: "churn-assessment",
        phase: "gather",
        sequence: 3,
        label: "Usage telemetry slice",
      },
    }),
  ]);

  const score = await app.skill("churn-risk-score", {
    context,
    args: { ...baseArgs, salesforce, zendesk, usage },
    schema: riskScore,
    trace: {
      parent: "churn-assessment",
      phase: "score",
      sequence: 4,
      dependsOn: ["churn-salesforce", "churn-zendesk", "churn-usage"],
    },
  });

  const savePlan = await app.skill("churn-playbook", {
    context,
    args: { ...baseArgs, score },
    schema: playbook,
    trace: {
      parent: "churn-assessment",
      phase: "recommend",
      sequence: 5,
      dependsOn: ["churn-risk-score"],
    },
  });

  const draft = {
    subject: `Churn risk brief: ${accountName}`,
    body: JSON.stringify({ accountName, score, savePlan }, null, 2),
  };

  return app.workflow("churn-assessment").start({
    signal,
    salesforce,
    zendesk,
    usage,
    score,
    playbook: savePlan,
    draft,
    approvalRequiredFor: ["crm.update"],
  });
});
