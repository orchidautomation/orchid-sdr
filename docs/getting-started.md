# Getting Started

This is the happy path. Trellis is now a curated GTM agent stack, not a toolkit for assembling your own agent framework.

The first boot should require only Node, npm, and deploy auth. Business providers come after the app is alive.

## 1. Install

From the repo root:

```bash
nvm use 22
npm install
npm run typecheck
npm test
```

## 2. Create An App

```bash
npm run trellis -- init ../acme-sdr --name acme-sdr
cd ../acme-sdr
npm install
```

`trellis init` writes the GTM app by default:

- `src/agent.ts`
- `knowledge/**/*.md`
- `skills/**/SKILL.md`
- `wrangler.jsonc`
- `.env.example`
- package scripts for `doctor`, `smoke`, `deploy`, and `verify`

No SDR kit, Convex app, Vercel Sandbox, or Rivet runtime is installed by default.

## 3. Authenticate The Deploy Runtime

Use Wrangler login or environment auth:

```bash
npm run cf:login
```

or:

```bash
export CLOUDFLARE_ACCOUNT_ID=<account-id>
export CLOUDFLARE_API_TOKEN=<api-token>
```

The generated app expects deploy bindings for managed state, knowledge/artifact packs, background queues, durable agent identity, and model routing. `trellis deploy` creates or verifies those resources for the default target.

The model is configured in `src/agent.ts`, for example `model: "anthropic/claude-sonnet-4.6"`. `TRELLIS_MODEL` can override it per environment without changing code.

## 4. Add Knowledge

Keep product truth in markdown:

```bash
npm run trellis -- docs add ./knowledge
```

This step is optional for the generated app. Deploy auto-packs the default `knowledge/**/*.md` files, so first boot does not require a separate docs command. Run `docs add` when you want `.trellis/knowledge-pack.json` with file paths, sizes, and hashes. Deploy uses that manifest when present, plus tracked `skills/**/SKILL.md` files, as the pack sync plan.

## 5. Verify Before Providers

```bash
npm run trellis -- doctor
npm run trellis -- smoke
npm run trellis -- verify cloudflare
```

`doctor` checks deploy wiring, markdown packs, skill packs, provider readiness, and the no-send safety gate.

`smoke` runs a safe GTM fixture through the Trellis runtime and proves the core loop works:

```text
signal -> qualification skill -> prospect -> blocked draft -> approvals -> audit -> workflow
```

## 6. Deploy

```bash
npm run trellis -- deploy
```

Deploy is the magic path. Trellis resolves or creates the managed database, pack store, events queue, and dead-letter queue, syncs markdown and skills, then deploys the app.

After deploy, verify the live Trellis surface:

```bash
npm run trellis -- verify cloudflare --live --url <app-url>
```

When you are ready to spend one safe model call to prove the live Trellis runtime, add `--exercise-agent`.

That live exercise also checks the production plumbing around the agent turn: persistence, provider-run recording, queue fanout, workflow dispatch, pack visibility, operator workflow replay, no-send approval gating, provider-action requeue, and the MCP snapshot after the signal is processed.

Use JSON output when another agent or setup tool is orchestrating the flow:

```bash
npm run trellis -- deploy --json
npm run trellis -- verify cloudflare --json
```

## 7. Connect Providers

Provider manifests are non-secret. Secrets stay in the deploy environment or your shell.

```bash
npm run trellis -- connect attio
npm run trellis -- connect mail
npm run trellis -- connect research
npm run trellis -- connect langfuse
```

The default GTM provider lanes are:

- Attio for CRM
- Trellis native mail on Cloudflare Email Service for email preview/send/replies
- Trellis research on Cloudflare Browser Run primitives
- Apify for optional discovery webhooks
- Prospeo for optional email enrichment
- Langfuse as optional trace/eval export

## Example

Use [`examples/gtm-sdr`](../examples/gtm-sdr/) as the reference example. It shows the public architecture: deployable GTM agent, form-fill signal, durable thread, markdown knowledge, typed skills, Cloudflare-backed email/research/browser tools, state map, approval-gated draft, smoke route, and audit-friendly workflow.
