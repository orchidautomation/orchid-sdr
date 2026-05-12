# Trellis User Guide

Trellis v3 is the GTM agent stack for teams that want to ship an agent without assembling the runtime, queues, storage, model routing, safety gates, provider glue, and observability from scratch.

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

- reliable HTTP endpoints for signals, approvals, smoke tests, and MCP
- durable state for accounts, prospects, inboxes, campaigns, and workflows
- queryable app history for audits, dashboards, and operator review
- packed markdown knowledge, skills, attachments, and artifacts
- background queues for provider work, retries, and handoffs
- long-running GTM workflows for research, approvals, sends, waits, and follow-up
- model routing and usage visibility without making the agent code messy
- heavier sandbox or browser automation only when the task actually needs it

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

// Map agent outputs to your CRM fields.
// Example: qualification.decision -> Attio `icp_status`.
import attioMap from "./crm/attio.map";

export default trellis.agent("gtm-sdr", {
  // Bring your GTM stack: CRM, email, and research.
  // Trellis handles the webhooks, retries, queues, logs, and approvals around them.
  crm: attio({ map: attioMap }),
  email: agentmail(),
  research: firecrawl(),

  // Give the agent your company context in markdown:
  // ICP, playbooks, product docs, roles, and repeatable skills.
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",

  // Start safe: drafts, CRM updates, and sends wait for human approval.
  safety: trellis.safeOutbound({
    noSends: true,
    requireApproval: ["email.send", "crm.update"],
  }),
}, async (app) => {
  // Accept one buying signal from a webhook, enrichment job, inbox, or form.
  const signal = await app.signal();

  // Qualify the account using your markdown skill and return typed data.
  const qualification = await app.skill("icp-qualification", {
    context: await app.context(signal),
    schema: schema.qualification(),
  });

  // Turn the result into durable work:
  // prospect state, blocked drafts, CRM updates, approvals, and audit history.
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
