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
- `POST /approvals/:id/approve`
- `POST /approvals/:id/reject`
- `POST /provider-actions/:id/execute`
- `POST /provider-actions/:id/complete`
- `POST /provider-actions/:id/fail`
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
- audit events

Those records are enough to prove the GTM control loop is observable and safe before any provider writes happen.

Approval decisions update D1, append an audit event, and enqueue a runtime event. Approved side effects create provider action intents. If no-send mode is still enabled, those intents are recorded as `blocked_no_send` instead of calling the provider.

Queued provider actions can be executed through `POST /provider-actions/:id/execute`. The executor refuses to run while no-send mode is enabled, refuses actions that are not `queued`, dispatches through a bound `TRELLIS_PROVIDER_EXECUTOR` when present, and includes built-in AgentMail `email.send` and Attio `crm.update` executors. Execution success or failure updates D1, appends audit, and emits queue events.

The generated Worker also exposes a Cloudflare Queues consumer through the same hidden runtime object. `trellis.provider.action.queued` messages are drained by the executor, acknowledged on handled outcomes, and retried on provider execution failures.

The Flue harness boundary receives a Trellis-generated tool catalog by default. The catalog starts with `trellis.health` and, when Firecrawl is the configured research provider, executable `research.search` and `research.extract` tools. `TRELLIS_MCP_TOOLS` can still override that catalog for advanced hosts.

Signal webhooks support optional shared-secret verification through `TRELLIS_WEBHOOK_SECRET` or `SIGNAL_WEBHOOK_SECRET`. If a secret is configured, callers must send either `Authorization: Bearer <secret>`, `x-trellis-webhook-secret`, or `x-webhook-secret`.

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

`app.skill(...)` first checks for a hidden harness binding. A provided `TRELLIS_HARNESS` can implement Trellis' structural `raw()` and `skill()` methods directly, while `TRELLIS_FLUE_CONTEXT` / `FLUE_CONTEXT` can expose Flue's `init()` shape. Trellis initializes the harness, opens a session by thread id, calls `session.skill(...)`, then validates the returned `data` or JSON text against the Zod schema supplied by the Trellis app. If no harness is present, smoke and local tests use the deterministic safe fixture path.

## Provider Manifests

Provider connection manifests live under `.trellis/providers/`. They are intentionally non-secret.

Supported v3 provider IDs:

- `attio`
- `agentmail`
- `firecrawl`
- `langfuse`

Provider credentials belong in Cloudflare secrets, local env, or the deployment environment.

## Verification

Local repository verification:

```bash
npm run typecheck
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
- `examples/reference-app`

Do not document those as the first-run product path.
