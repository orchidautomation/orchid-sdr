import { trellis } from "@trellis/gtm";
import { attio, browser, mail, research } from "@trellis/providers";
import browserProfiles from "./browser/profiles.map";
import attioMap from "./crm/attio.map";
import mailSequenceMap from "./email/mail.sequence.map";
import { sdrMcpSurface } from "./mcp/sdr-surface";
import stateMap from "./state/prospect.map";
import { prospectSteps, replySteps, runSkillStep } from "./workflow";

export default trellis.agent("common-room-bdr", {
  // Runtime capabilities the agent can use while doing SDR work.
  crm: attio({ map: attioMap }),
  mail: mail({ sequence: mailSequenceMap }),
  browser: browser({ profiles: browserProfiles }),
  research: research({ profiles: browserProfiles }),

  // Human/operator surface available through MCP clients.
  mcp: sdrMcpSurface,

  // Runtime shape: model route, mounted knowledge, mounted skills, state, safety.
  model: "cloudflare/openai/gpt-5.5",
  state: stateMap,
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound({
    noSends: false,
    requireApproval: prospectSteps.queueCrmUpdate.approvalGate,
  }),
}, async (app) => {
  // A signal is the incoming work item: webhook, API request, reply, or operator event.
  const signal = await app.signal();

  // Context loads the agent's knowledge, thread history, state, and capabilities.
  const context = await app.context(signal);

  // Reply path: classify the response, then decide if a person should take over.
  if (signal.source === "reply.webhook") {
    const reply = await runSkillStep(app, replySteps.classifyReply, { context });
    const handoff = await runSkillStep(app, replySteps.decideHandoff, {
      context,
      args: { reply },
    });

    return app.workflow("reply").start({ signal, reply, handoff });
  }

  // New prospect path: qualify, research, draft, then queue the CRM update.
  const qualification = await runSkillStep(app, prospectSteps.qualifyLead, { context });
  const researchBrief = await runSkillStep(app, prospectSteps.researchAccount, {
    context,
    args: { qualification },
  });
  const draft = await runSkillStep(app, prospectSteps.draftOutbound, {
    context,
    args: { qualification, research: researchBrief },
  });

  return app.workflow("prospect").start({
    signal,
    qualification,
    research: researchBrief,
    draft,
    approvalRequiredFor: prospectSteps.queueCrmUpdate.approvalGate,
  });
});
