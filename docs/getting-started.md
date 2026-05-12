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

- `agents/gtm-sdr.ts`
- `knowledge/**/*.md`
- `skills/**/SKILL.md`
- `wrangler.jsonc`
- `.env.example`
- package scripts for `doctor`, `smoke`, and `deploy`

No SDR kit, Convex app, Vercel Sandbox, or Rivet runtime is installed by default.

## 3. Authenticate Cloudflare

Use Wrangler login or environment auth:

```bash
npx wrangler login
```

or:

```bash
export CLOUDFLARE_ACCOUNT_ID=<account-id>
export CLOUDFLARE_API_TOKEN=<api-token>
```

The generated app expects Cloudflare bindings for:

- D1 app state
- R2 knowledge and artifact packs
- Queues
- Durable Objects / Cloudflare Agents
- AI Gateway routing

## 4. Add Knowledge

Keep product truth in markdown:

```bash
npm run trellis -- docs add ./knowledge
```

This writes `.trellis/knowledge-pack.json` with file paths, sizes, and hashes. Deploy uses that manifest plus tracked `skills/**/SKILL.md` files as the R2-backed pack sync plan.

## 5. Verify Before Providers

```bash
npm run trellis -- doctor
npm run trellis -- smoke
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

Use JSON output when another agent or setup tool is orchestrating the flow:

```bash
npm run trellis -- deploy --json
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
- Langfuse as optional trace/eval export

## Legacy Material

`examples/reference-app` and the older framework packages remain in the repo only as parity and migration material while v3 catches up to the existing AI SDR behavior. They are not the v3 public architecture.
