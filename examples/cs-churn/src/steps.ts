import type { TrellisGtmApp, TrellisSignal, TrellisSkillTraceContext } from "@trellis/gtm";
import { z } from "zod";

type AccountArgs = {
  accountName: string;
  accountId?: string;
};

type StepRunInput = {
  context: Record<string, unknown>;
  args?: Record<string, unknown>;
};

export type SkillStepDefinition = {
  phase: string;
  name: string;
  skill: string;
  agentTools: readonly string[];
  operatorTools: readonly string[];
  produces: string;
  outputSchema: OutputSchemaName;
  observability?: TrellisSkillTraceContext;
};

export type ApprovalStepDefinition = {
  phase: string;
  name: string;
  agentTools: readonly string[];
  operatorTools: readonly string[];
  produces: string;
  approvalGate: readonly string[];
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

export const outputSchemas = {
  evidence,
  riskScore,
  playbook,
};

export type OutputSchemaName = keyof typeof outputSchemas;

export function defineSkillStep<T extends SkillStepDefinition>(definition: T): T {
  return definition;
}

export function defineApprovalStep<T extends ApprovalStepDefinition>(definition: T): T {
  return definition;
}

export function runSkillStep(app: TrellisGtmApp, step: SkillStepDefinition, input: StepRunInput) {
  return app.skill(step.skill, {
    context: input.context,
    args: input.args,
    schema: outputSchemas[step.outputSchema],
    trace: step.observability,
  });
}

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
