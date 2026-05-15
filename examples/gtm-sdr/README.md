# Trellis Cloud BDR Demo

This repo is the demoable Trellis BDR agent environment.

It shows a Common Room-style BDR agent that turns a Pylon form-fill signal into a qualified prospect, research brief, approval-gated email draft, and CRM update proposal. The point is not "the model can write email." The point is that Trellis gives GTM teams a private, auditable agent runtime with skills, knowledge, tools, traces, approvals, state, provider actions, and portable operator surfaces.

See `reference/diagnostics/bdr-demo-runbook.md` for the complete demo runbook.
See `reference/diagnostics/live-video-outline.md` for the short video walkthrough and talk track.
See `reference/diagnostics/cloud-walkthrough.md` for the original form-fill SDR walkthrough.
See `reference/outputs/pylon-live-run.md` for the current D1-derived demo output.

## Layout

```text
src/          runnable Trellis Worker app code
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
  -> R2 knowledge and skills
  -> GPT-5.5 through Cloudflare AI Gateway
  -> qualification
  -> account research
  -> SDR draft
  -> D1 trace and state
  -> approval gates for email and CRM
  -> MCP-ready operator surfaces
```

Canonical live worker:

```text
https://trellis-cloud-sdr.brandon-ccf.workers.dev
```

The seed command generates a fresh signal and trace id each time so Cloudflare Workflow instance ids never collide with an old demo run. The trace id shape is:

```text
trace_demo_bdr_pylon_<runId>
```

Current seeded trace:

```text
trace_demo_bdr_pylon_ready_20260515_1512
```

See `reference/diagnostics/live-run-result.md` for the current deployed D1 counts, approvals, trace summary, draft, and cost.

## First Boot

```bash
npm install
npm run cf:login
npm run deploy
npm run smoke
npm run verify
```

The first deploy is Cloudflare-first and does not require Attio, AgentMail, or Firecrawl credentials. Those are connected after the app boots:

```bash
npx wrangler secret put TRELLIS_API_KEY
npm run trellis -- connect attio
npm run trellis -- connect agentmail
npm run trellis -- connect firecrawl
npm run trellis -- connect apify      # optional discovery source
npm run trellis -- connect prospeo    # optional email enrichment
npm run trellis -- docs add ./product-docs
```

Your app code stays Trellis-only in `src/agent.ts`. Attio field mapping lives in `src/crm/attio.map.ts`: rename the keys to your Attio attribute API slugs, then point each value at extracted Trellis context like `qualification.decision`, `qualification.summary`, or `signal.payload.signal`. Durable business state lives in `src/state/prospect.map.ts`: define tables, fields, indexes, and relationships while Trellis keeps D1 migrations private. The generated `src/trellis-runtime.ts` adapter mounts Trellis R2 markdown packs into the virtual sandbox, uses the Cloudflare AI binding through the default AI Gateway, and stores per-thread agent sessions in `TRELLIS_DB`.

Deploy auto-packs the default `knowledge/**/*.md` files, or uses `.trellis/knowledge-pack.json` when you run `trellis docs add <path>`. It also syncs tracked `skills/**/SKILL.md` files into the `TRELLIS_PACKS` R2 bucket. Outbound writes stay in no-send mode until approval gates are configured.

`GET /smoke` is safe and never writes to providers. `POST /smoke/attio` is an explicit provider smoke: it requires `ATTIO_API_KEY` plus `TRELLIS_PROVIDER_SMOKE_TOKEN`, writes a deterministic smoke company/person through the Attio field map, and returns HTTP 200 only when Attio accepts the mapped write.

## Demo Reset And Seed

Use these when the live demo environment has verifier traces or old test rows.

The reset/seed scripts default to the canonical hosted demo. Set `TRELLIS_DEMO_BASE_URL` and `TRELLIS_DEMO_DB_NAME` when running against your own deployed copy.

Reset the remote D1 runtime tables:

```bash
TRELLIS_DEMO_RESET_CONFIRM=reset npm run demo:reset-db
```

Seed the curated BDR signal:

```bash
npm run demo:seed-bdr
```

The seed posts `reference/inputs/demo-form-payload.json` and should create:

- one Pylon signal
- one prospect state projection
- one approval-gated draft
- two pending approvals: `email.send` and `crm.update`
- trace events for qualification, research, copy, workflow, draft, approval waiting, and run completion

## Claude Code MCP Demo

Claude Code can connect project-locally to:

```text
https://trellis-cloud-sdr.brandon-ccf.workers.dev/mcp/trellis
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
Use trellis-sdr to describe this BDR agent.
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
