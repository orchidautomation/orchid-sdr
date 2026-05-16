import { trellis } from "@trellis/gtm";
import { attio, browser, mail, research as researchProvider } from "@trellis/providers";
import browserProfiles from "./browser/profiles.map";
import attioMap from "./crm/attio.map";
import mailSequenceMap from "./email/mail.sequence.map";
import { sdrMcpSurface } from "./mcp/sdr-surface";
import stateMap from "./state/prospect.map";
import {
  approvalGates,
  defineApprovalStep,
  defineSkillStep,
  runSkillStep,
} from "./steps";

const replyPath = {
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

const prospectPath = {
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

export default trellis.agent("common-room-bdr", {
  // Runtime capabilities the agent can use while doing SDR work.
  crm: attio({ map: attioMap }),
  mail: mail({ sequence: mailSequenceMap }),
  browser: browser({ profiles: browserProfiles }),
  research: researchProvider({ profiles: browserProfiles }),

  // Human/operator surface available through MCP clients.
  mcp: sdrMcpSurface,

  // Runtime shape: model route, mounted knowledge, mounted skills, state, safety.
  model: "cloudflare/openai/gpt-5.5",
  state: stateMap,
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound({
    noSends: false,
    requireApproval: prospectPath.queueCrmUpdate.approvalGate,
  }),
}, async (app) => {
  // A signal is the incoming work item: webhook, API request, reply, or operator event.
  const signal = await app.signal();

  // Context loads the agent's knowledge, thread history, state, and capabilities.
  const context = await app.context(signal);

  // Reply path: classify the response, then decide if a person should take over.
  if (signal.source === "reply.webhook") {
    const reply = await runSkillStep(app, replyPath.classifyReply, { context });
    const handoff = await runSkillStep(app, replyPath.decideHandoff, {
      context,
      args: { reply },
    });

    return app.workflow("reply").start({ signal, reply, handoff });
  }

  // New prospect path: qualify, research, draft, then queue the CRM update.
  const qualification = await runSkillStep(app, prospectPath.qualifyLead, { context });
  const research = await runSkillStep(app, prospectPath.researchAccount, {
    context,
    args: { qualification },
  });
  const draft = await runSkillStep(app, prospectPath.draftOutbound, {
    context,
    args: { qualification, research },
  });

  return app.workflow("prospect").start({
    signal,
    qualification,
    research,
    draft,
    approvalRequiredFor: prospectPath.queueCrmUpdate.approvalGate,
  });
});
