# Trellis BDR Demo Runbook

This demo shows Trellis as a reliable BDR agent operating system, not a one-off prompt.

The story:

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
  -> MCP/Slack/Notion/Linear-ready operator surfaces
```

## What Makes This Demo Special

| Capability | What to show | Why it matters |
| --- | --- | --- |
| Agent runtime | `src/agent.ts` has one clean Trellis BDR flow. | The business logic is readable and not buried in Cloudflare/Flue plumbing. |
| Skills | `skills/icp-qualification`, `skills/research-brief`, `skills/sdr-copy`, `skills/reply-policy`, `skills/handoff-policy`. | GTM methodology is versioned as explicit playbooks. |
| Knowledge | `knowledge/company.md`, `knowledge/icp.md`, `knowledge/messaging.md`. | The agent follows company positioning and ICP rules, not generic model memory. |
| Cloudflare execution | Worker, D1, R2, Queue, Workflow, Workers AI/Gateway, Browser binding. | The demo is deployed production-style instead of running only on a laptop. |
| Observability | `trellis_trace_events` plus `/events`, `/events/stream`, and SDR run views. | Every step can be inspected and replayed. |
| Cost visibility | `estimate_cost` on the SDR MCP and `GET /traces/:traceId/cost`. | A team can see what the model run cost. |
| Human gating | Email and CRM actions become approvals and provider actions. | The agent drafts and queues, but does not send or mutate external systems without a human. |
| Portability | MCP works in Claude Code; Slack/Notion/Linear are operator surfaces. | The same agent can be used where the team already works. |

## Demo Environment Contract

The clean demo environment should contain one curated BDR signal and no verifier noise.

Base demo payload:

```text
file: inputs/demo-form-payload.json
workspace: wrk_common_room_demo
source: website.form
company: Pylon
```

`npm run demo:seed-bdr` generates a fresh id set each run:

```text
signal: sig_demo_bdr_pylon_<runId>
trace: trace_demo_bdr_pylon_<runId>
thread: lead:pylon:alex-rivera:<runId>
```

This avoids Cloudflare Workflow instance-id collisions after a database reset, because Workflow instance history is not stored in D1.

The signal is intentionally demo-safe. It is a realistic Pylon/Common Room workflow, not a real private lead.

## Reset The Demo Database

This deletes only Trellis runtime rows from the remote D1 database. It keeps schema and Cloudflare resources intact.

```bash
TRELLIS_DEMO_RESET_CONFIRM=reset npm run demo:reset-db
```

Tables cleared:

- `trellis_signals`
- `trellis_prospects`
- `trellis_drafts`
- `trellis_approvals`
- `trellis_provider_actions`
- `trellis_provider_runs`
- `trellis_workflow_runs`
- `trellis_audit_events`
- `trellis_trace_events`
- `trellis_state_records`
- `trellis_agent_sessions`
- `trellis_smoke_runs`
- `trellis_operator_controls`
- `trellis_slack_threads`

## Seed The Curated BDR Signal

Set `TRELLIS_API_KEY` or `TRELLIS_MCP_TOKEN` locally if the deployed Worker is protected.

```bash
npm run demo:seed-bdr
```

The script posts `inputs/demo-form-payload.json` to:

```text
https://trellis-cloud-sdr.brandon-ccf.workers.dev/webhooks/signals
```

Expected result:

- HTTP 202
- one signal
- one prospect
- one draft
- two pending approvals: `email.send` and `crm.update`
- trace events for signal, provider run, skills, workflow, draft, approvals, and run completion

## Verify The Demo State

Use the same Trellis MCP that Claude Code sees:

```text
Ask trellis-sdr: describe this agent.
Ask trellis-sdr: list current leads.
Ask trellis-sdr: show pending approvals.
Ask trellis-sdr: get the Pylon lead.
Ask trellis-sdr: estimate trace cost for the latest Pylon trace.
Ask trellis-operator: show runtime health and operator controls.
```

Or use HTTP:

```bash
curl -sS "$TRELLIS_DEMO_BASE_URL/events?traceId=<traceId>&limit=100"
curl -sS "$TRELLIS_DEMO_BASE_URL/approvals/pending?traceId=<traceId>"
curl -sS "$TRELLIS_DEMO_BASE_URL/traces/<traceId>/cost"
```

Add `Authorization: Bearer $TRELLIS_API_KEY` if the deployed route is protected.

## Talk Track

1. Start in Claude Code and show that `trellis-sdr` is the SDR MCP server and `trellis-operator` is the control-plane MCP server.
2. Ask `trellis-sdr` to describe the agent. It should identify Cloudflare runtime, D1, R2 knowledge, skills, safety rails, and providers.
3. Ask whether there are leads. It should show the curated Pylon BDR signal, not verifier/test rows.
4. Ask for the trace. Walk through `signal.accepted -> skill.started/completed -> workflow.started -> draft.created -> approval.waiting -> run.completed`.
5. Ask for pending approvals. Explain that outbound and CRM writes are gated.
6. Ask for cost. Show that model usage comes from D1 trace events, not a separate vendor dashboard.
7. Explain surfaces: `trellis-sdr` is the SDR role surface, `trellis-operator` is the platform surface, and Slack, Notion, and Linear can operate the same runtime without becoming the runtime.

## Demo Close

The point is not that Trellis can draft an email. The point is that a GTM team can own a reliable BDR workflow:

- business rules in skills
- company context in knowledge
- model/tool orchestration in a durable session
- Cloudflare runtime primitives
- queryable D1 state
- approval gates before side effects
- traces, costs, and replayable operator controls
- one agent usable from MCP, Slack, Notion, Linear, dashboard, or API
