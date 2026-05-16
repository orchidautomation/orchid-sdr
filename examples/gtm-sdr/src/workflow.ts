import {
  approvalGates,
  defineApprovalStep,
  defineSkillStep,
  runSkillStep,
} from "./steps";

export { runSkillStep };

export const replySteps = {
  classifyReply: defineSkillStep({
    phase: "Reply Phase 1",
    name: "Classify inbound reply",
    skill: "reply-policy",
    agentTools: ["thread.history", "email.reply"],
    operatorTools: ["list_replies"],
    produces: "reply classification and recommended next action",
    outputSchema: "replyPolicy",
    observability: {
      parent: "reply",
      phase: "classify",
      sequence: 1,
      label: "Classify inbound reply",
    },
  }),

  decideHandoff: defineSkillStep({
    phase: "Reply Phase 2",
    name: "Decide if a human should take over",
    skill: "handoff-policy",
    agentTools: ["reply classification", "handoff.webhook"],
    operatorTools: ["list_handoffs"],
    produces: "human handoff recommendation",
    outputSchema: "handoffPolicy",
    observability: {
      parent: "reply",
      phase: "handoff",
      sequence: 2,
      dependsOn: ["reply-policy"],
      label: "Decide whether a human should take over",
    },
  }),
};

export const prospectSteps = {
  qualifyLead: defineSkillStep({
    phase: "Prospect Phase 1",
    name: "Qualify the lead against ICP",
    skill: "icp-qualification",
    agentTools: ["knowledge.icp", "crm.readAccount"],
    operatorTools: ["qualify_lead", "list_leads", "get_lead"],
    produces: "qualified/disqualified lead verdict",
    outputSchema: "qualification",
    observability: {
      parent: "prospect",
      phase: "qualify",
      sequence: 1,
      label: "Qualify lead",
    },
  }),

  researchAccount: defineSkillStep({
    phase: "Prospect Phase 2",
    name: "Research the account and buyer",
    skill: "research-brief",
    agentTools: ["research.search", "research.scrape", "browser.session.run"],
    operatorTools: ["research_account"],
    produces: "account and buyer research brief",
    outputSchema: "researchBrief",
    observability: {
      parent: "prospect",
      phase: "research",
      sequence: 2,
      dependsOn: ["icp-qualification"],
      label: "Research account",
    },
  }),

  draftOutbound: defineSkillStep({
    phase: "Prospect Phase 3",
    name: "Draft the outbound email",
    skill: "sdr-copy",
    agentTools: ["knowledge.messaging", "qualification output", "research output"],
    operatorTools: ["draft_email", "list_pending_approvals", "approve_draft"],
    produces: "approval-gated outbound draft",
    outputSchema: "outboundDraft",
    observability: {
      parent: "prospect",
      phase: "draft",
      sequence: 3,
      dependsOn: ["research-brief"],
      label: "Draft outbound message",
    },
  }),

  queueCrmUpdate: defineApprovalStep({
    phase: "Prospect Phase 4",
    name: "Queue the CRM update for approval",
    agentTools: ["crm.update"],
    operatorTools: ["list_pending_approvals", "approve_draft", "reject_draft"],
    produces: "human-reviewable CRM update proposal",
    approvalGate: approvalGates.prospect,
  }),
};
