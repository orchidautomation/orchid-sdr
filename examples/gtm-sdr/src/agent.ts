import { trellis, schema } from "@trellis/gtm";
import { attio, browser, mail, research } from "@trellis/providers";
import browserProfiles from "./browser/profiles.map";
import attioMap from "./crm/attio.map";
import agentmailSequenceMap from "./email/agentmail.sequence.map";
import { sdrMcpSurface } from "./mcp/sdr-surface";
import stateMap from "./state/prospect.map";

export default trellis.agent("common-room-bdr", {
  // Providers are mounted once, then used by skills and workflows through Trellis.
  crm: attio({ map: attioMap }),
  mail: mail({ adapter: "agentmail", sequence: agentmailSequenceMap }),
  browser: browser({ profiles: browserProfiles }),
  research: research({ profiles: browserProfiles }),

  // The model, knowledge pack, skill pack, state map, and safety gates define
  // the agent runtime. The Worker plumbing stays outside this file.
  model: "cloudflare/openai/gpt-5.5",
  state: stateMap,
  mcp: sdrMcpSurface,
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  // Demo mode keeps a mail adapter configured for sequence demos, but the live
  // walkthrough below omits mail.send from the approval list so the current
  // demo can focus on approving one CRM update.
  safety: trellis.safeOutbound({
    noSends: false,
    requireApproval: ["crm.update"],
  }),
}, async (app) => {
  // Every webhook, API call, or operator event enters as a normalized signal.
  // Context hydrates the signal with mounted knowledge, skills, thread history,
  // and provider capabilities before any model step runs.
  const signal = await app.signal();
  const context = await app.context(signal);

  // Replies resume the same thread. Trellis classifies the reply, decides
  // whether a person should take over, then starts a reply workflow.
  if (signal.source === "reply.webhook") {
    const reply = await app.skill("reply-policy", {
      context,
      schema: schema.replyPolicy(),
    });
    const handoff = await app.skill("handoff-policy", {
      context,
      args: { reply },
      schema: schema.handoffPolicy(),
    });

    return app.workflow("reply").start({ signal, reply, handoff });
  }

  // New prospect flow: qualify the signal against the knowledge pack and
  // return schema-shaped data that Trellis can persist and inspect.
  const qualification = await app.skill("icp-qualification", {
    context,
    schema: schema.qualification(),
  });

  // Research uses the qualification result and mounted research provider to
  // produce grounded account/person evidence for the copy step.
  const research = await app.skill("research-brief", {
    context,
    args: { qualification },
    schema: schema.researchBrief(),
  });

  // Copy creates a draft only. This demo shows approval on CRM update, so
  // mail.send stays commented out below instead of becoming an approval.
  const draft = await app.skill("sdr-copy", {
    context,
    args: { qualification, research },
    schema: schema.outboundDraft(),
  });

  const approvalRequiredFor = [
    // "mail.send",
    "crm.update",
  ];

  // The durable workflow persists state, trace events, draft approvals, and
  // any queued provider actions while keeping the lead's thread resumable.
  return app.workflow("prospect").start({ signal, qualification, research, draft, approvalRequiredFor });
});
