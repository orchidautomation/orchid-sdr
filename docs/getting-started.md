# Getting Started

This is the v3 happy path. Trellis is now a curated GTM agent stack, not a toolkit for assembling your own agent framework.

The first boot should require only Node, npm, and Cloudflare auth. Business providers come after the app is alive.

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

`trellis init` writes the v3 Cloudflare GTM app by default:

- `src/agent.ts`
- `knowledge/**/*.md`
- `skills/**/SKILL.md`
- `wrangler.jsonc`
- `.env.example`
- package scripts for `doctor`, `smoke`, `deploy`, and `verify`

No SDR kit, Convex app, Vercel Sandbox, or Rivet runtime is installed by default.

## 3. Authenticate Cloudflare

Use Wrangler login or environment auth:

```bash
npm run cf:login
```

or:

```bash
export CLOUDFLARE_ACCOUNT_ID=<account-id>
export CLOUDFLARE_API_TOKEN=<api-token>
```

The generated app expects Cloudflare bindings for:

- D1 app state, with `database_id` resolved during first deploy
- R2 knowledge and artifact packs
- Queues, including an events dead-letter queue
- Durable Objects / Cloudflare Agents
- AI Gateway routing through `TRELLIS_AI_GATEWAY_ID` (defaults to `default`)

The model is configured in `src/agent.ts` with `model: trellis.model(...)`. The generated default uses Cloudflare Workers AI, and `TRELLIS_MODEL` can override it per environment without changing code.

## 4. Add Knowledge

Keep product truth in markdown:

```bash
npm run trellis -- docs add ./knowledge
```

This step is optional for the generated app. Deploy auto-packs the default `knowledge/**/*.md` files, so first boot does not require a separate docs command. Run `docs add` when you want `.trellis/knowledge-pack.json` with file paths, sizes, and hashes. Deploy uses that manifest when present, plus tracked `skills/**/SKILL.md` files, as the R2-backed pack sync plan.

## 5. Verify Before Providers

```bash
npm run trellis -- doctor
npm run trellis -- smoke
npm run trellis -- verify cloudflare
```

`doctor` checks Cloudflare wiring, markdown packs, skill packs, provider readiness, and the no-send safety gate.

`smoke` runs a safe GTM fixture through the Trellis runtime and proves the core loop works:

```text
signal -> qualification skill -> prospect -> blocked draft -> approvals -> audit -> workflow
```

## 6. Deploy

```bash
npm run trellis -- deploy
```

Deploy is the magic path. For the generated `wrangler.jsonc`, Trellis resolves or creates the D1 database, writes the `database_id`, creates or verifies the R2 buckets, creates or verifies the events queue and dead-letter queue, syncs markdown and skills into R2, then runs `wrangler deploy`.

After deploy, verify the live Cloudflare surface:

```bash
npm run trellis -- verify cloudflare --live --url https://<your-worker>.workers.dev
```

When you are ready to spend one safe model call to prove the hidden Flue/Cloudflare harness, add `--exercise-agent`.

That live exercise also checks the production plumbing around the agent turn: D1 persistence, provider-run recording, Queue fanout, Workflow dispatch, R2 pack visibility, operator workflow replay, no-send approval gating, provider-action requeue, and the MCP snapshot after the signal is processed.

Use JSON output when another agent or setup tool is orchestrating the flow:

```bash
npm run trellis -- deploy --json
npm run trellis -- verify cloudflare --json
```

## 7. Connect Providers

Provider manifests are non-secret. Secrets stay in Cloudflare env or your shell.

```bash
npm run trellis -- connect attio
npm run trellis -- connect agentmail
npm run trellis -- connect firecrawl
npm run trellis -- connect langfuse
```

The default GTM provider lanes are:

- Attio for CRM
- AgentMail for email preview/send/replies
- Firecrawl for research
- Apify for optional discovery webhooks
- Prospeo for optional email enrichment
- Langfuse as optional trace/eval export

## Legacy Material

`examples/reference-app` and the older framework packages remain in the repo only as parity and migration material while v3 catches up to the existing AI SDR behavior. They are not the v3 public architecture.
