# Trellis User Guide

Trellis is the GTM agent stack for teams that want to ship an agent without assembling the runtime, queues, storage, model routing, safety gates, provider glue, and observability from scratch.

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

The default smoke path stays safe: `GET /smoke` and `trellis smoke` never write to providers. Once Attio is connected, `POST /smoke/attio` or `trellis verify cloudflare --live --url <app-url> --attio-smoke --provider-smoke-token <token>` performs the explicit CRM integration smoke: it writes a deterministic smoke company/person through `src/crm/attio.map.ts` and returns HTTP 200 only if Attio accepts the mapped write.

## The 20-ish Line Pitch

```ts
import { trellis, schema } from "@trellis/gtm";
import { attio, agentmail, firecrawl } from "@trellis/providers";

// Map agent outputs to your CRM fields.
// Example: qualification.decision -> Attio `icp_status`.
import attioMap from "./crm/attio.map";

// Define durable business tables, fields, indexes, and relationships.
// Trellis turns this into managed database state.
import stateMap from "./state/prospect.map";

export default trellis.agent("gtm-sdr", {
  // Bring your GTM stack: CRM, email, and research.
  // Trellis handles the webhooks, retries, queues, logs, and approvals around them.
  crm: attio({ map: attioMap }),
  email: agentmail(),
  research: firecrawl(),

  // Pick the LLM once. You can override this per environment with TRELLIS_MODEL.
  model: "anthropic/claude-sonnet-4.6",

  // Choose the business schema Trellis remembers in its database.
  // Tables, fields, indexes, and relationships live in this map.
  state: stateMap,

  // Give the agent your company context in markdown:
  // ICP, playbooks, product docs, roles, and repeatable skills.
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",

  // Name the operator/tool surface so teams can run multiple agents clearly.
  mcp: { name: "trellis-gtm-sdr" },

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

That snippet is the public story. The generated Trellis wrapper mounts health checks, signal webhooks, MCP, dashboard, persistence, queues, and smoke routes around it.

## Model, Database, And Schema

The LLM belongs in the agent config:

```ts
model: "anthropic/claude-sonnet-4.6"
```

That keeps the “what brain runs this?” decision visible without forcing a user to wire provider SDKs. Production can override it with `TRELLIS_MODEL` so teams can move between a cheap default, a stronger reasoning model, or a customer-specific model without changing agent logic.

The database should not be a hand-written connection in the pitch snippet. `trellis deploy` provisions and binds the app database as `TRELLIS_DB`, then Trellis owns the operational tables for signals, prospects, drafts, approvals, workflows, provider actions, audit events, traces, and smoke runs. Users should feel like they get durable state by default, not like they have to design infrastructure before the first agent works.

There are really three schemas:

- **Skill output schema**: `schema.qualification()` validates what the agent extracts before workflows or provider writes happen.
- **CRM field map**: `src/crm/attio.map.ts` maps extracted Trellis values to Attio attributes.
- **Business state schema**: `src/state/prospect.map.ts` defines business tables, fields, indexes, and relationships, while Trellis keeps the low-level runtime tables and migrations private and reliable.

The state schema should feel like a small product model, not a raw migration:

```ts
export default trellis.state({
  tables: {
    prospects: {
      primaryKey: "id",
      fields: {
        id: "prospect.id",
        signalId: "signal.id",
        company: "signal.payload.company",
        domain: "signal.payload.domain",
        status: "qualification.decision",
        summary: "qualification.summary",
        confidence: { source: "qualification.confidence", type: "number" },
      },
      indexes: [
        { name: "prospects_by_domain", fields: ["domain"] },
        { name: "prospects_by_status", fields: ["status"] },
      ],
      relationships: {
        signal: { table: "signals", local: "signalId", foreign: "id" },
      },
    },
  },
});
```

That gives a user one obvious place to say “what tables should Trellis remember, how are they shaped, and how do they relate?” without exposing migrations or storage details in the happy path.

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

The deploy runtime is not a provider choice in the happy path. Trellis owns it.
