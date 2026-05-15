# Trellis Cloud SDR Demo

This demo shows how a GTM team can turn an opted-in form fill into a researched, qualified, approval-gated SDR draft with durable per-lead memory.

## Demo Setup

- Seller profile: Common Room-style buyer intelligence platform.
- Prospect account: Pylon (`usepylon.com`), researched live from public web sources.
- Lead: demo person attached to a real company/domain so the workflow is safe to show without fabricating a private real inbox.
- Runtime: Cloudflare Worker, D1, R2, Queue, Workflow, AI Gateway, and Trellis virtual sandbox.
- Research tools: Trellis `research.search`, `research.extract`, and `research.map`, backed by Firecrawl.
- State: `src/state/prospect.map.ts` defines accounts, people, prospects, drafts, signals, indexes, and relationships.
- Safety: outbound is draft-only until an approval gate allows a provider action.

## 25-Line Pitch Example

```ts
import { trellis, schema } from "@trellis/gtm";
import { firecrawl } from "@trellis/providers";
import state from "./state/prospect.map";

export default trellis.agent("common-room-sdr", {
  research: firecrawl(),                    // live company/person research
  model: "@cf/openai/gpt-oss-20b",           // Cloudflare AI Gateway model route
  state,                                    // D1 tables, indexes, relationships
  knowledge: "knowledge/**/*.md",           // ICP, company, messaging
  skills: "skills/**/SKILL.md",             // qualification, research, copy, reply policy
  safety: trellis.safeOutbound(),           // no sends or CRM writes without approval
}, async (app) => {
  const signal = await app.signal();        // website/LinkedIn form payload
  const context = await app.context(signal); // payload + knowledge + date + thread

  const qualification = await app.skill("icp-qualification", {
    context,
    schema: schema.qualification(),          // output must match database-safe shape
  });

  const research = await app.skill("research-brief", {
    context,
    args: { qualification },
    schema: schema.researchBrief(),          // cited, evidence-based account brief
  });

  const draft = await app.skill("sdr-copy", {
    context,
    args: { qualification, research },
    schema: schema.outboundDraft(),          // approval-gated email draft
  });

  return app.workflow("prospect").start({ signal, qualification, research, draft });
});
```

## What Happens

1. A person fills out the form with name, email, title, company, domain, message, and consent.
2. Trellis normalizes the signal and preserves the supplied `threadId`.
3. The agent loads the Common Room demo knowledge pack from R2.
4. The qualification skill decides whether the account is qualified, needs review, or disqualified.
5. The research skill can call Firecrawl-backed Trellis tools to search, extract, or map public pages.
6. The copy skill drafts a short email grounded in the form signal and public evidence.
7. Trellis writes structured state according to `src/state/prospect.map.ts`.
8. The workflow returns a 202 with a traceable result; outbound stays blocked until approved.

## Threading

The important identifier is `threadId`.

For the first Pylon form fill, the demo uses:

```json
"threadId": "lead:pylon:alex-rivera"
```

If Alex replies three days later, the reply webhook should reuse the same `threadId`. Trellis resumes that lead's session, including prior research, qualification, drafts, tool calls, and reasoning context. Bob, Alex, and every other lead get separate durable histories because each lead has a separate `threadId`.

## Why Brendan's Post Matters

The Brendan Short post is the positioning wedge: AI SDRs fail when teams buy a vendor before diagnosing the pipeline problem. This demo frames Trellis Cloud as the operating layer for the diagnosis loop: capture signal, classify the actual problem, research with evidence, preserve context, run experiments, and keep humans in the approval path.

That is more credible than promising "an AI SDR that sells for you." It shows a system a GTM team can inspect, improve, and trust.
