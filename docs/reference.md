# Trellis Reference

This page describes the v3 public surface. Historical Convex/Vercel/Rivet reference-app details are legacy parity material and should not be used as the default setup path.

## CLI

```bash
trellis init <target>
trellis docs add <path>
trellis doctor
trellis smoke
trellis deploy
trellis connect <provider>
```

Use `--json` when another agent, plugin, or setup UI is driving the flow.

## Runtime Routes

The generated Cloudflare app should expose:

- `GET /healthz`
- `GET /smoke`
- `POST /webhooks/signals`
- `POST /webhooks/agentmail`
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`
- `POST /provider-actions/:id/execute`
- `POST /provider-actions/:id/complete`
- `POST /provider-actions/:id/fail`
- `GET /operator/controls`
- `POST /operator/kill-switch/enable`
- `POST /operator/kill-switch/disable`
- `POST /operator/campaigns/:id/pause`
- `POST /operator/campaigns/:id/resume`
- `POST /operator/threads/:id/pause`
- `POST /operator/threads/:id/resume`
- `POST /operator/workflows/:id/replay`
- `POST /operator/provider-actions/:id/replay`
- `POST /mcp/trellis`
- `GET /dashboard`
- `POST /agents/*` for durable agent dispatch

## Runtime State

The v3 baseline persists:

- signals
- prospects
- drafts
- approvals
- provider actions
- workflow runs
- audit events
- trace events

Those records are enough to prove the GTM control loop is observable and safe before any provider writes happen. Trellis derives or accepts a stable `traceId` at signal ingest, carries it through workflow dispatch, approvals, provider action intents, queue messages, and side-effect execution, and records the timeline in `trellis_trace_events`.

`trellis_trace_events` is the canonical trace log. Optional exporters can mirror each trace event to a bound `TRELLIS_TRACE_EXPORTER`, a generic `TRELLIS_TRACE_EXPORT_URL`, Langfuse, or Braintrust. Export failures are swallowed after the D1 write so signal ingest, approvals, workflow replay, and provider action execution keep moving. `/healthz`, `/mcp/trellis`, and the dashboard expose whether trace export is configured without leaking secrets.

Approval decisions update D1, append an audit event, and enqueue a runtime event. Approved side effects create provider action intents. If no-send mode is still enabled, those intents are recorded as `blocked_no_send` instead of calling the provider.

After a webhook run is persisted and enqueued, Trellis starts the configured `PROSPECT_WORKFLOW` binding with a stable instance id and params containing the signal, workflow name, prospect ids, draft ids, approval ids, and audit event ids. Dispatch and workflow checkpoints are recorded in `trellis_workflow_runs`; dispatch errors are returned as `workflowDispatch.ok: false` but do not make webhook ingestion fail.

Queued provider actions can be executed through `POST /provider-actions/:id/execute`. The executor refuses to run while no-send mode is enabled, refuses actions that are not `queued`, dispatches through a bound `TRELLIS_PROVIDER_EXECUTOR` when present, and includes built-in AgentMail `email.send` / `mail.reply`, Attio `crm.update`, and `handoff.webhook` executors. Execution success or failure updates D1, appends audit, and emits queue events.

Completed `email.send` actions automatically schedule a `follow_up` run on `PROSPECT_WORKFLOW`. The schedule uses `TRELLIS_FOLLOW_UP_DELAY` when set, defaults to `3 days`, carries the provider message/thread ids into the workflow params, and records `scheduled`, `follow_up_scheduled`, and `follow_up_due` checkpoints in `trellis_workflow_runs`.

Operator controls live in `trellis_operator_controls`. The global kill switch and campaign/thread pause records are exposed through `/operator/*` routes, the dashboard, and the MCP snapshot. Active controls block workflow dispatch before Cloudflare Workflows start and block queued provider-action execution before side effects run. Each control change writes audit, trace, and queue events.

Replay controls use the existing durable records instead of asking operators to understand the queue substrate. `POST /operator/workflows/:id/replay` reads the stored workflow params from `trellis_workflow_runs`, creates a new Cloudflare Workflow instance, and records the replay. `POST /operator/provider-actions/:id/replay` moves a failed or blocked provider action back to `queued` and emits a new `trellis.provider.action.queued` message for recovery.

The generated Worker also exposes a Cloudflare Queues consumer through the same hidden runtime object. `trellis.provider.action.queued` messages are drained by the executor and acknowledged on handled outcomes. Provider execution failures are recorded, reset to `queued` for the Cloudflare retry attempt, and can still be requeued manually through the operator replay route after DLQ inspection.

`GET /smoke` remains safe to run before provider credentials are connected. When `TRELLIS_DB` is bound, it writes a row to `trellis_smoke_runs`, appends a `smoke.pass` or `smoke.fail` trace event, and surfaces the count through MCP and the dashboard.

The Flue harness boundary receives a Trellis-generated tool catalog by default. The catalog starts with `trellis.health` and, when Firecrawl is the configured research provider, executable `research.search` and `research.extract` tools. `TRELLIS_MCP_TOOLS` can still override that catalog for advanced hosts.

Signal webhooks support optional shared-secret verification through `TRELLIS_WEBHOOK_SECRET` or `SIGNAL_WEBHOOK_SECRET`. If a secret is configured, callers must send either `Authorization: Bearer <secret>`, `x-trellis-webhook-secret`, or `x-webhook-secret`.

AgentMail reply webhooks can be posted to `POST /webhooks/agentmail`. `message.received` events are normalized into Trellis signals with `provider: "agentmail"` and `source: "reply.webhook"`, then processed through the same pack, harness, D1, queue, draft, approval, and audit path as generic signals. If `AGENTMAIL_WEBHOOK_SECRET` is configured, Trellis accepts either a bound `TRELLIS_AGENTMAIL_WEBHOOK_VERIFIER(rawBody, headers, secret)` verifier or a shared-secret `Authorization: Bearer <secret>` / `x-agentmail-webhook-secret` header.

Signal webhooks also accept `Idempotency-Key`, `x-trellis-idempotency-key`, or `idempotencyKey` in the JSON body. If the payload does not provide a signal id, Trellis derives a stable id from that key.

## Knowledge And Skills

Knowledge lives in markdown:

- `knowledge/icp.md`
- `knowledge/product.md`
- `knowledge/usp.md`
- `knowledge/compliance.md`
- any additional product or market docs

Skills live in tracked `SKILL.md` files:

- `skills/icp-qualification/SKILL.md`
- `skills/research-brief/SKILL.md`
- `skills/sdr-copy/SKILL.md`
- `skills/reply-policy/SKILL.md`
- `skills/handoff-policy/SKILL.md`

Run:

```bash
trellis docs add ./knowledge
```

to create the local manifest that deploy can verify and upload into the Cloudflare-backed pack store.

`trellis deploy` syncs:

- `.trellis/knowledge-pack.json` to `knowledge/manifest.json`
- verified knowledge markdown to `knowledge/files/*`
- tracked `skills/**/SKILL.md` files to `skills/files/*`

For generated Cloudflare apps, deploy also provisions the first-run infrastructure it can safely own: D1 database resolution/creation, `database_id` config updates, R2 bucket creation/verification, and events queue plus dead-letter queue creation/verification.

At runtime, the Worker reads `TRELLIS_PACKS`, hydrates bounded markdown contents from `knowledge/files/*` and `skills/files/*`, passes that pack context into the agent run, and exposes pack counts through the webhook response, MCP snapshot, and dashboard.

`app.skill(...)` first checks for a hidden harness binding. Generated v3 apps provide `TRELLIS_FLUE_CONTEXT_FACTORY`, which builds a real `@flue/sdk` context after Trellis has parsed the signal and hydrated R2 packs. The generated adapter preloads `AGENTS.md`, `knowledge/*`, and `.agents/skills/*/SKILL.md` into Flue's virtual sandbox, registers the Cloudflare AI binding through the default AI Gateway, and stores Flue session state in `TRELLIS_DB`. Advanced hosts can still provide a structural `TRELLIS_HARNESS` or direct `TRELLIS_FLUE_CONTEXT`. If no harness is present, smoke and local tests use the deterministic safe fixture path.

## Provider Manifests

Provider connection manifests live under `.trellis/providers/`. They are intentionally non-secret.

Supported v3 provider IDs:

- `attio`
- `agentmail`
- `firecrawl`
- `langfuse`
- `braintrust`

Provider credentials belong in Cloudflare secrets, local env, or the deployment environment.

## Verification

Local repository verification:

```bash
npm run typecheck
npm run build
npm test
npm run trellis -- doctor --json
npm run trellis -- smoke --json
npm run trellis -- deploy --json
```

Generated app verification:

```bash
npm run trellis -- doctor
npm run trellis -- smoke
npm run trellis -- deploy
```

## Legacy Commands

Older composition commands and the AI SDR reference app remain only for migration work:

- `trellis add ... --legacy`
- `trellis init ... --legacy`
- `trellis init ... --kit sdr`
- `npm run legacy:*`
- `npm run build:all`
- `examples/reference-app`

Do not document those as the first-run product path.
