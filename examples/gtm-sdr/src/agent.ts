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
  // Every webhook, API call, or operator event enters as a normalized signal.
  const signal = await app.signal();
  const context = await app.context(signal);

  // Reply path: classify the response, then decide if a person should take over.
  if (signal.source === "reply.webhook") {
    const reply = await steps.classifyReply.run(app, { context });
    const handoff = await steps.decideHandoff.run(app, {
      context,
      args: { reply },
    });

    return app.workflow("reply").start({ signal, reply, handoff });
  }

  // New prospect path: qualify, research, draft, then queue the CRM update.
  const qualification = await steps.qualifyLead.run(app, { context });
  const research = await steps.researchAccount.run(app, {
    context,
    args: { qualification },
  });
  const draft = await steps.draftOutbound.run(app, {
    context,
    args: { qualification, research },
  });

  // The workflow records the run history and waits for human approval before CRM writes.
  return app.workflow("prospect").start({
    signal,
    qualification,
    research,
    draft,
    approvalRequiredFor: approvalGates.prospect,
  });
});
