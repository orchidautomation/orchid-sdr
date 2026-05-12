# Trellis User Guide

Trellis v3 is the GTM agent stack for teams that want to ship an agent without assembling the harness, runtime, queues, storage, gateway, safety gates, provider glue, and observability from scratch.

The product promise is intentionally narrow: build and deploy a reliable GTM agent with one blessed stack, then connect the business systems you actually need.

## What Trellis Is

Trellis owns the GTM product contract:

- inbound signals
- account and prospect context
- markdown knowledge packs
- skills as operating judgment
- qualification outputs
- blocked drafts
- approval gates
- workflow starts
- audit events
- dashboard and MCP inspection

Trellis hides the plumbing:

- Flue for the agent harness
- Cloudflare Workers for HTTP
- Cloudflare Agents / Durable Objects for identity and state locality
- D1 for queryable app state
- R2 for knowledge, skills, attachments, and artifacts
- Queues for background work and retries
- Workflows for long-running GTM steps
- AI Gateway for model routing and usage visibility
- Sandbox or browser primitives only when lightweight filesystem context is not enough

## The Demo Shape

The demo should read like a product, not infrastructure assembly:

```bash
trellis init acme-sdr
trellis docs add ./knowledge
trellis doctor
trellis smoke
trellis deploy
trellis connect attio
trellis connect agentmail
trellis connect firecrawl
```

The proof point is that a user can see one signal become a qualified prospect, a blocked outbound draft, two pending approvals, audit events, and a workflow start without touching Convex, Rivet, Vercel Sandbox, or custom orchestration code.

The default smoke path stays safe: `GET /smoke` and `trellis smoke` never write to providers. Once Attio is connected, `POST /smoke/attio` or `trellis verify cloudflare --live --url <worker-url> --attio-smoke --provider-smoke-token <token>` performs the explicit CRM integration smoke: it writes a deterministic smoke company/person through `src/crm/attio.map.ts` and returns HTTP 200 only if Attio accepts the mapped write.

## The 20-ish Line Pitch

```ts
import { trellis, schema } from "@trellis/gtm";
import { attio, agentmail, firecrawl } from "@trellis/providers";
import attioMap from "./crm/attio.map";

export default trellis.agent("gtm-sdr", {
  crm: attio({ map: attioMap }),
  email: agentmail(),
  research: firecrawl(),
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound({
    noSends: true,
    requireApproval: ["email.send", "crm.update"],
  }),
}, async (app) => {
  const signal = await app.signal();
  const qualification = await app.skill("icp-qualification", {
    context: await app.context(signal),
    schema: schema.qualification(),
  });

  return app.workflow("prospect").start({ signal, qualification });
});
```

That snippet is the public story. The generated Cloudflare wrapper can mount health checks, signal webhooks, MCP, dashboard, persistence, queues, and smoke routes around it.

## Safety Defaults

New apps should start in no-send mode.

Approvals are product state, not comments in a log. Trellis should persist and expose:

- which draft is blocked
- which action is gated
- who or what approved it
- when it changed state
- what audit event proves the transition

## Provider Strategy

Do not make users choose every primitive.

The default GTM stack ships with a small business-level provider surface:

- `trellis connect attio`
- `trellis connect agentmail`
- `trellis connect firecrawl`
- `trellis connect langfuse`

Cloudflare is not a provider choice in the happy path. It is the runtime Trellis uses.

## Legacy Reference App

The existing AI SDR app remains useful because it proves the desired behavior: discovery, ingest, research, qualification, copy, CRM sync, replies, handoff, dashboard, and MCP.

It is not the v3 architecture. Use it as a parity checklist while moving behavior into the curated Cloudflare-first runtime.
