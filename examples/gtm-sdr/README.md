# Trellis GTM SDR Example

This example is a demoable Trellis SDR agent environment.

It shows a Common Room-style SDR agent that turns a Pylon form-fill signal into a qualified prospect, research brief, email draft, and approval-gated CRM update proposal. The point is not "the model can write email." The point is that Trellis gives GTM teams a private, auditable agent runtime with skills, knowledge, tools, observability, approvals, state, provider actions, and portable operator surfaces.

See `reference/diagnostics/bdr-demo-runbook.md` for the complete demo runbook.
See `reference/diagnostics/live-video-outline.md` for the short video walkthrough and talk track.
See `reference/outputs/pylon-live-run.md` for the current Trellis-derived demo output.

## Layout

```text
src/          runnable Trellis Worker app code
  agent.ts    short runtime story and approval gate
  steps.ts    step definitions: skill, tools, output schema, observability
knowledge/    mounted company, ICP, and messaging context
skills/       mounted GTM method playbooks
scripts/      local demo and maintenance scripts
reference/    demo inputs, outputs, diagnostics, and walkthrough material
```

## Current Demo Story

```text
Pylon form fill
  -> Trellis signal
  -> durable thread
  -> Trellis knowledge and skills
  -> GPT-5.5 through the configured model route
  -> qualification
  -> account research
  -> SDR draft
  -> Trellis trace and state
  -> approval gate for the CRM update
  -> MCP-ready operator surfaces
```

Hosted demo endpoint used by the included seed scripts:

```text
$TRELLIS_DEMO_BASE_URL
```

The seed command generates a fresh signal and trace id each time so workflow instance ids never collide with an old demo run. The trace id shape is:

```text
trace_demo_bdr_pylon_<runId>
```

See `reference/diagnostics/live-run-result.md` for the current deployed Trellis counts, approvals, trace summary, draft, and cost.

## First Boot

```bash
npm install
npm run cf:login
npm run deploy
npm run smoke
npm run verify
```

The first deploy does not require provider credentials. Add provider secrets when you want live research or explicit CRM smoke writes:

```bash
npx wrangler secret put TRELLIS_API_KEY
npm run trellis -- connect attio
npm run trellis -- connect mail
npm run trellis -- connect research
npm run trellis -- connect browser
npm run docs:add
```

Your app code stays Trellis-only in `src/agent.ts`. Attio field mapping lives in `src/crm/attio.map.ts`: rename the keys to your Attio attribute API slugs, then point each value at extracted Trellis context like `qualification.decision`, `qualification.summary`, or `signal.payload.signal`. Email sequencing lives in `src/email/agentmail.sequence.map.ts`: define the initial send, follow-up reply steps, delays, approval policy, and stop rules while Trellis keeps provider actions approval-gated and auditable. Browser and research profiles live in `src/browser/profiles.map.ts`, so extraction and browser automation share explicit viewport, locale, wait, and resource-loading rules. Durable business state lives in `src/state/prospect.map.ts`: define tables, fields, indexes, and relationships while Trellis keeps runtime migrations private. The generated `src/trellis-runtime.ts` adapter mounts Trellis markdown packs into the virtual sandbox, uses the configured model route, and stores per-thread agent sessions in managed runtime state.

`src/steps.ts` is the drilldown file for new builders. It shows each step's skill, tools/capabilities, output schema, and observability labels without making `agent.ts` hard to scan.

Deploy auto-packs the default `knowledge/**/*.md` files, or uses `.trellis/knowledge-pack.json` when you run `trellis docs add <path>`. It also syncs tracked `skills/**/SKILL.md` files into the Trellis pack store. Email is mounted with a sequence map, but `email.send` is intentionally omitted from the current demo approval list; CRM writes still require approval before execution.

## Mail Sequence Map

The sequence map is the email-motion equivalent of the Attio and state maps:

```text
src/email/agentmail.sequence.map.ts
```

It declares:

- `defaultInboxId`: usually `env:AGENTMAIL_INBOX_ID`
- `stopOn`: reply, unsubscribe, bounce, manual pause, and kill switch conditions
- `steps`: initial send and follow-up reply steps with delays and approval policy

The workflow runtime handles per-lead waits. The Worker also has a cron trigger in `wrangler.jsonc`:

```text
*/15 * * * *
```

That scheduled handler sweeps runtime state for overdue follow-up workflow rows and marks them due or stopped. This gives the sequence system both durable sleeps and a repair loop.

`GET /smoke` is safe and never writes to providers. `POST /smoke/attio` is an explicit provider smoke: it requires `ATTIO_API_KEY` plus `TRELLIS_PROVIDER_SMOKE_TOKEN`, writes a deterministic smoke company/person through the Attio field map, and returns HTTP 200 only when Attio accepts the mapped write.

## Demo Reset And Seed

Use these when the live demo environment has verifier runs or old test rows.

The reset/seed scripts default to the canonical hosted demo. Set `TRELLIS_DEMO_BASE_URL` and `TRELLIS_DEMO_DB_NAME` when running against your own deployed copy.

Reset the remote Trellis runtime tables:

```bash
TRELLIS_DEMO_RESET_CONFIRM=reset npm run demo:reset-db
```

Seed the curated SDR signal:

```bash
npm run demo:seed-bdr
```

The seed posts `reference/inputs/demo-form-payload.json` and should create:

- one Pylon signal
- one prospect state projection
- one generated email draft
- one pending approval: `crm.update`
- observability events for qualification, research, copy, workflow, draft, approval waiting, and run completion

## Claude Code MCP Demo

Claude Code can connect to the hosted demo endpoint:

```text
$TRELLIS_DEMO_BASE_URL/mcp/trellis
```

The configured MCP name is `trellis-sdr`. It exposes the SDR-facing surface, not the full Trellis operator control plane:

```text
describe_agent
list_leads
get_lead
pipeline_stats
estimate_cost
list_pending_approvals
approve_draft
reject_draft
edit_and_approve_draft
list_handoffs
list_replies
research_account
qualify_lead
draft_email
```

This list is declared on the agent, so another Trellis agent can expose a different role surface without framework edits:

```ts
mcp: {
  name: "trellis-sdr",
  surface: "sdr",
  operator: {
    name: "trellis-operator",
  },
  tools: {
    include: ["list_leads", "get_lead", "approve_draft", "qualify_lead"],
    exclude: ["edit_and_approve_draft"],
    skillTools: [
      {
        name: "qualify_lead",
        skill: "icp-qualification",
        schema: schema.qualification(),
      },
    ],
  },
}
```

`trellis-operator` points at `/mcp/operator` and keeps the full runtime control plane separate from the SDR pipeline tools.

Good prompts:

```text
Use trellis-sdr to describe this SDR agent.
```

```text
Use trellis-sdr to show the current leads and pending approvals.
```

```text
Use trellis-sdr to estimate the cost of the latest Pylon trace.
```

```text
Use trellis-sdr to explain why the Pylon draft is blocked and what a human can approve.
```
