# Trellis Notion Command Center Demo

This is a showpiece demo for the new Trellis operator story:

> Build the GTM agent once in Trellis, then operate it from the surfaces where the team already works.

For this demo, the surface is a Notion-style GTM command center. The current payload simulates a Notion database row. When `@trellis/notion` exists, the same signal can come from a Notion Worker tool or External Agent event.

## What It Shows

- A GTM engineer creates or updates a Notion account row.
- Trellis receives that row as a structured signal.
- The Cloudflare Worker runs the Trellis agent with R2-mounted knowledge and skills.
- Flue sessions preserve thread memory by `threadId`.
- Trellis emits D1 trace events that can be replayed or streamed.
- The agent creates a qualified account brief and approval-gated SDR draft, or records a safe fallback if the model/tool harness times out.
- The CRM update path is ready for Attio, but blocked until a human approval and the real Attio secret are present.

## Why It Lands

This connects the Notion, Slack, Attio, and Trellis story in one concrete workflow:

- Notion is the planning and review workspace.
- Trellis is the private execution plane.
- Cloudflare is the deployment/runtime layer.
- Attio is the CRM system of record for approved account/person updates.
- Trace events provide auditability.
- Approval gates keep provider writes and sends under human control.

## Demo Payload

Use:

```text
docs/demo-notion-command-center-payload.json
```

The payload represents a Notion database row:

- account: Pylon
- trigger: GTM team asks for AI SDR reliability follow-up
- requested workflow: research, qualify, draft, prepare Attio CRM update
- trace id: `trace_notion_pylon_command_center_004`
- thread id: `account:pylon:notion-command-center`

## Talk Track

1. Show the Notion-style row: "Pylon - AI SDR reliability follow-up."
2. Explain that Notion is not running the agent. It is the operator surface.
3. Submit the row to Trellis.
4. Show `/events` or `/events/stream` filling with lifecycle events.
5. Show the generated qualification, research brief, and draft.
6. Show approval gates for email and CRM.
7. Explain that Attio writes are impossible until explicitly approved and configured.
8. Close with the positioning: GTM teams can build custom workflows without handing their process to an off-the-shelf black box.

## Run Against The Live Worker

Live Worker:

```text
https://trellis-cloud-sdr.brandon-ccf.workers.dev
```

Submit the signal:

```bash
curl -sS \
  -X POST "https://trellis-cloud-sdr.brandon-ccf.workers.dev/webhooks/signals" \
  -H "content-type: application/json" \
  --data @docs/demo-notion-command-center-payload.json
```

Replay trace events:

```bash
curl -sS "https://trellis-cloud-sdr.brandon-ccf.workers.dev/events?traceId=trace_notion_pylon_command_center_004&limit=100"
```

Watch stream:

```bash
curl -N "https://trellis-cloud-sdr.brandon-ccf.workers.dev/events/stream?traceId=trace_notion_pylon_command_center_004"
```

If `TRELLIS_API_KEY` is later enabled on the Worker, add:

```bash
-H "Authorization: Bearer $TRELLIS_API_KEY"
```

## Attio Readiness

The app is now Attio-ready:

- `src/agent.ts` includes `crm: attio({ map: attioMap })`
- `src/crm/attio.map.ts` maps Trellis signal fields to Attio company/person fields
- `.trellis/providers/attio.json` exists
- live verifier recognizes Attio as connected

Remaining live blocker:

- Cloudflare Worker secret `ATTIO_API_KEY` is not set.

Set the two live secrets before running a real Attio smoke write:

```bash
npx wrangler secret put ATTIO_API_KEY
npx wrangler secret put TRELLIS_PROVIDER_SMOKE_TOKEN
```

Then run the explicit provider smoke:

```bash
npm run verify -- \
  --live \
  --url https://trellis-cloud-sdr.brandon-ccf.workers.dev \
  --attio-smoke \
  --provider-smoke-token "$TRELLIS_PROVIDER_SMOKE_TOKEN" \
  --json
```

That call intentionally writes a deterministic smoke company/person to Attio. Do not run it during a public demo unless the demo workspace is safe for test records.

## Current Live Run Notes

Latest live trace:

```text
trace_notion_pylon_command_center_004
```

This run completed with HTTP 202 and proved the control-plane story:

- signal accepted from `notion.database.row`
- D1 persistence enabled across Trellis tables
- queue message created
- workflow dispatched
- draft created
- `email.send` approval created
- `crm.update` approval created
- trace events persisted and replayable from `/events`

The current live model route is still too slow for a polished public copy-quality demo. The run safely fell back on some skills after timeout. For a live audience, use this demo to show operator surfaces, traces, approvals, and provider safety. Before using it to showcase final outbound copy quality, tune the model/skill path or pre-run the trace and show the recorded artifact.

## Expected Viewer Takeaway

Trellis is not just another AI SDR demo. It is an operator-controlled GTM agent runtime:

- private execution
- structured state
- durable threads
- traceability
- model/tool orchestration
- MCP-compatible control
- approval-gated provider actions
- team-facing surfaces like Slack and Notion

The Notion version is compelling because it turns agent work into a normal team workflow: assign it, watch it, approve it, audit it, and preserve the artifact.
