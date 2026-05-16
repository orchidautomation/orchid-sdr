import { schema, type TrellisGtmApp, type TrellisSkillTraceContext } from "@trellis/gtm";
import { z } from "zod";

type StepRunInput = {
  context: Record<string, unknown>;
  args?: Record<string, unknown>;
};

type StepDefinition = {
  skill: string;
  agent_tools: string[];
  operator_tools?: string[];
  produces: string;
  schema: z.ZodTypeAny;
  observability?: TrellisSkillTraceContext;
};

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

export const steps = {
  classifyReply: skillStep({
    skill: "reply-policy",
    agent_tools: ["thread.history", "mail.reply"],
    operator_tools: ["list_replies"],
    produces: "reply classification and next action",
    schema: schema.replyPolicy(),
    observability: {
      parent: "reply",
      phase: "classify",
      sequence: 1,
      label: "Classify inbound reply",
    },
  }),

  decideHandoff: skillStep({
    skill: "handoff-policy",
    agent_tools: ["reply classification", "handoff.webhook"],
    operator_tools: ["list_handoffs"],
    produces: "human handoff recommendation",
    schema: schema.handoffPolicy(),
    observability: {
      parent: "reply",
      phase: "handoff",
      sequence: 2,
      dependsOn: ["reply-policy"],
      label: "Decide whether a human should take over",
    },
  }),

  qualifyLead: skillStep({
    skill: "icp-qualification",
    agent_tools: ["knowledge.icp", "crm.readAccount"],
    operator_tools: ["qualify_lead", "list_leads", "get_lead"],
    produces: "qualified/disqualified lead verdict",
    schema: schema.qualification(),
    observability: {
      parent: "prospect",
      phase: "qualify",
      sequence: 1,
      label: "Qualify lead",
    },
  }),

  researchAccount: skillStep({
    skill: "research-brief",
    agent_tools: ["research.search", "research.scrape", "browser.session.run"],
    operator_tools: ["research_account"],
    produces: "account and buyer research brief",
    schema: schema.researchBrief(),
    observability: {
      parent: "prospect",
      phase: "research",
      sequence: 2,
      dependsOn: ["icp-qualification"],
      label: "Research account",
    },
  }),

  draftOutbound: skillStep({
    skill: "sdr-copy",
    agent_tools: ["knowledge.messaging", "qualification output", "research output"],
    operator_tools: ["draft_email", "list_pending_approvals", "approve_draft"],
    produces: "approval-gated outbound draft",
    schema: schema.outboundDraft(),
    observability: {
      parent: "prospect",
      phase: "draft",
      sequence: 3,
      dependsOn: ["research-brief"],
      label: "Draft outbound message",
    },
  }),
};

export const approvalGates = {
  prospect: [
    // "email.send",
    "crm.update",
  ],
};
