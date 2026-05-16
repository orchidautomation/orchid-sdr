import { schema, type TrellisGtmApp, type TrellisSkillTraceContext } from "@trellis/gtm";

type StepRunInput = {
  context: Record<string, unknown>;
  args?: Record<string, unknown>;
};

export const outputSchemas = {
  replyPolicy: schema.replyPolicy(),
  handoffPolicy: schema.handoffPolicy(),
  qualification: schema.qualification(),
  researchBrief: schema.researchBrief(),
  outboundDraft: schema.outboundDraft(),
};

export type OutputSchemaName = keyof typeof outputSchemas;

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
  prospect: [
    // "email.send",
    "crm.update",
  ],
};
