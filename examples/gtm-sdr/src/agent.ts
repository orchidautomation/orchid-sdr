import { trellis, schema } from "@trellis/gtm";
import { firecrawl } from "@trellis/providers";
import stateMap from "./state/prospect.map";

// This is the whole GTM agent. The Worker wrapper, database bindings,
// queues, workflows, model routing, pack loading, and smoke routes live in
// generated Trellis runtime code so the business logic stays readable here.
export default trellis.agent("sdr", {
  // Give the agent approved public-web research tools:
  // research.search, research.extract, and research.map.
  research: firecrawl(),

  // Pick the model once. Production can still override this with TRELLIS_MODEL.
  model: "anthropic/claude-sonnet-4.6",

  // Define the business state Trellis should remember in D1:
  // accounts, people, prospects, drafts, and signals.
  state: stateMap,

  // Mount markdown company context and repeatable operating procedures.
  // These are loaded into the agent runtime from the repo/R2 pack.
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",

  // Protect webhooks and operator routes once TRELLIS_API_KEY is configured.
  // /healthz and /smoke stay public-safe.
  auth: trellis.auth.apiKey(),

  // Default to no-send mode with approval gates for risky side effects.
  safety: trellis.safeOutbound(),
}, async (app) => {
  // Accept one normalized GTM event, such as a website form fill,
  // LinkedIn opt-in, product signal, or reply webhook.
  const signal = await app.signal();

  // Build the working context: signal payload, mounted knowledge, today's date,
  // thread history, provider tools, and durable runtime metadata.
  const context = await app.context(signal);

  // Replies resume the same durable thread. The agent classifies the reply,
  // decides whether a human should take over, then starts the reply workflow.
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

  // First pass: decide whether the person/account is worth pursuing.
  // The schema makes the model return database-safe structured data.
  const qualification = await app.skill("icp-qualification", {
    context,
    schema: schema.qualification(),
  });

  // Second pass: gather and summarize evidence for the copywriter.
  // This skill may call the Firecrawl-backed Trellis research tools.
  const research = await app.skill("research-brief", {
    context,
    args: { qualification },
    schema: schema.researchBrief(),
  });

  // Third pass: draft the outbound email. Trellis stores it as blocked
  // pending approval; this skill never sends anything.
  const draft = await app.skill("sdr-copy", {
    context,
    args: { qualification, research },
    schema: schema.outboundDraft(),
  });

  // Start the durable prospect workflow: persist state, create approvals,
  // queue follow-up work, and keep the lead's thread resumable.
  return app.workflow("prospect").start({ signal, qualification, research, draft });
});
