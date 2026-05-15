import { trellis, schema } from "@trellis/gtm";
import { attio, firecrawl } from "@trellis/providers";
import attioMap from "./crm/attio.map";
import stateMap from "./state/prospect.map";

export default trellis.agent("common-room-bdr", {
  crm: attio({ map: attioMap }),
  research: firecrawl(),
  model: "cloudflare/openai/gpt-5.5",
  state: stateMap,
  mcp: {
    name: "trellis-sdr",
    surface: "sdr",
    operator: {
      name: "trellis-operator",
    },
    tools: {
      include: [
        "describe_agent",
        "list_leads",
        "get_lead",
        "pipeline_stats",
        "estimate_cost",
        "list_pending_approvals",
        "approve_draft",
        "reject_draft",
        "edit_and_approve_draft",
        "list_handoffs",
        "list_replies",
        "research_account",
        "qualify_lead",
        "draft_email",
      ],
      skillTools: [
        {
          name: "qualify_lead",
          skill: "icp-qualification",
          description: "Run just the BDR ICP qualification skill without starting the full workflow.",
          schema: schema.qualification(),
        },
        {
          name: "draft_email",
          skill: "sdr-copy",
          description: "Run just the BDR outbound copy skill without starting the full workflow.",
          schema: schema.outboundDraft(),
        },
      ],
    },
  },
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound(),
}, async (app) => {
  const signal = await app.signal();
  const context = await app.context(signal);

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

  const qualification = await app.skill("icp-qualification", {
    context,
    schema: schema.qualification(),
  });
  const research = await app.skill("research-brief", {
    context,
    args: { qualification },
    schema: schema.researchBrief(),
  });
  const draft = await app.skill("sdr-copy", {
    context,
    args: { qualification, research },
    schema: schema.outboundDraft(),
  });

  return app.workflow("prospect").start({ signal, qualification, research, draft });
});
