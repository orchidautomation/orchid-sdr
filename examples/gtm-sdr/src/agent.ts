import { trellis } from "@trellis/gtm";
import { attio, browser, mail, research as researchProvider } from "@trellis/providers";
import browserProfiles from "./browser/profiles.map";
import attioMap from "./crm/attio.map";
import agentmailSequenceMap from "./email/agentmail.sequence.map";
import { sdrMcpSurface } from "./mcp/sdr-surface";
import stateMap from "./state/prospect.map";
import { approvalGates, steps } from "./steps";

export default trellis.agent("common-room-bdr", {
  // Runtime capabilities the agent can use while doing SDR work.
  crm: attio({ map: attioMap }),
  mail: mail({ adapter: "agentmail", sequence: agentmailSequenceMap }),
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
    requireApproval: approvalGates.prospect,
  }),
}, async (app) => {
  // A signal is the incoming work item: webhook, API request, reply, or operator event.
  const signal = await app.signal();

  // Context loads the agent's knowledge, thread history, state, and capabilities.
  const context = await app.context(signal);

  // Reply path: classify the response, then decide if a person should take over.
  if (signal.source === "reply.webhook") {
    // Reply Step 1
    // Skill: reply-policy
    // Uses: thread.history, mail.reply
    // Related MCP: list_replies
    // Output schema: replyPolicy in src/steps.ts
    const reply = await steps.classifyReply.run(app, { context });

    // Reply Step 2
    // Skill: handoff-policy
    // Uses: reply classification, handoff.webhook
    // Related MCP: list_handoffs
    // Output schema: handoffPolicy in src/steps.ts
    const handoff = await steps.decideHandoff.run(app, {
      context,
      args: { reply },
    });

    return app.workflow("reply").start({ signal, reply, handoff });
  }

  // New prospect path: qualify, research, draft, then queue the CRM update.
  // Prospect Step 1
  // Skill: icp-qualification
  // Uses: knowledge.icp, crm.readAccount
  // Related MCP: qualify_lead, list_leads, get_lead
  // Output schema: qualification in src/steps.ts
  const qualification = await steps.qualifyLead.run(app, { context });

  // Prospect Step 2
  // Skill: research-brief
  // Uses: research.search, research.scrape, browser.session.run
  // Related MCP: research_account
  // Output schema: researchBrief in src/steps.ts
  const research = await steps.researchAccount.run(app, {
    context,
    args: { qualification },
  });

  // Prospect Step 3
  // Skill: sdr-copy
  // Uses: knowledge.messaging, qualification output, research output
  // Related MCP: draft_email, list_pending_approvals, approve_draft
  // Output schema: outboundDraft in src/steps.ts
  const draft = await steps.draftOutbound.run(app, {
    context,
    args: { qualification, research },
  });

  // Prospect Step 4: record the run and wait for human approval before CRM writes.
  // Approval gate: crm.update
  // Related MCP: list_pending_approvals, approve_draft, reject_draft
  return app.workflow("prospect").start({
    signal,
    qualification,
    research,
    draft,
    approvalRequiredFor: approvalGates.prospect,
  });
});
