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
- `POST /mcp/trellis`
- `GET /dashboard`
- `POST /agents/*` for durable agent dispatch

## Runtime State

The v3 baseline persists:

- signals
- prospects
- drafts
- approvals
- audit events

Those records are enough to prove the GTM control loop is observable and safe before any provider writes happen.

Approval decisions update D1, append an audit event, and enqueue a runtime event. Provider side effects still remain blocked until the approved action executor exists.

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
