# Getting Started

This is the shortest path to a working Trellis app.

If your goal is one demo, use the reference app already in this repo before scaffolding a custom app.

Canonical order:

1. copy `.env.example` to `.env`
2. fill the minimum core env
3. keep `NO_SENDS_MODE=true`
4. run `npm run doctor`
5. run `npm run dev` or deploy
6. verify `/dashboard` and `/healthz`
7. connect MCP
8. ingest one signal

## 1. Use The Existing Reference App First

From the repo root:

```bash
nvm use 22
npm install
cp .env.example .env
```

Minimum core env for a real demo:

- `APP_URL`
- `CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `TRELLIS_SANDBOX_TOKEN`
- `TRELLIS_MCP_TOKEN`
- `HANDOFF_WEBHOOK_SECRET`
- `RIVET_ENDPOINT`
- `RIVET_TOKEN`
- `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_KEY`
- `NO_SENDS_MODE=true`

Then run:

```bash
npx convex dev
npm run typecheck
npm test
npm run doctor
npm run dev
```

Keep `npx convex dev` running while you do real local development against Convex. Trellis uses the repo-root `convex.json` file to point Convex at the reference app functions in `examples/reference-app/convex`.

If port `3000` is already in use, either stop the old process or set a new app port:

```bash
PORT=3001 npm run dev
```

If you only want a boot check before wiring Convex, use smoke mode:

```bash
export TRELLIS_LOCAL_SMOKE_MODE=true
export TRELLIS_SANDBOX_TOKEN=local-sandbox-token
export HANDOFF_WEBHOOK_SECRET=local-handoff-secret
npm run doctor
npm run dev
```

Smoke mode is only for boot and dashboard checks.

## 2. Scaffold

```bash
npm run trellis -- init ../trellis-core --name trellis-core
```

That command scaffolds the base Trellis runtime and nothing extra:

- normalized signal webhook ingest
- Convex state
- Rivet actor runtime
- Vercel Sandbox
- Vercel AI Gateway
- first-party Trellis MCP

After boot, add capabilities incrementally:

```bash
npm run trellis -- add source apify --apply
npm run trellis -- add search firecrawl --apply
npm run trellis -- add extract firecrawl --apply
npm run trellis -- add deep-research parallel --apply
npm run trellis -- add enrichment prospeo --apply
```

Or choose optional lanes up front with flags:

```bash
npm run trellis -- init ../trellis-core-plus --name trellis-core-plus --with-discovery --with-deep-research
```

The CLI no longer owns a guided wizard, and it no longer exposes starter/production profiles.
Guided onboarding should sit on top of the CLI, not inside it.
When an agent or plugin is driving setup, use the JSON contract:

```bash
npm run trellis -- init ../trellis-core --name trellis-core --json
npm run doctor -- --json
npm run trellis -- connect source apify --json
npm run trellis -- deploy local --json
npm run trellis -- mcp claude-code --local --write --json
```

## 3. Install

```bash
cd <your-target-directory>
npm install
cp .env.example .env
```

## 4. Fill the minimum env

At minimum:

- `APP_URL`
- `CONVEX_URL`
- `TRELLIS_SANDBOX_TOKEN`
- `HANDOFF_WEBHOOK_SECRET`
- `NO_SENDS_MODE=true`

If the scaffolded lanes include additional providers, fill those after the core env is working.

## 5. Which accounts do you really need?

To simply boot the app safely, the required env block is enough.

To actually feel the product as a new user:

- base runtime
  - `Convex`
  - `Vercel` for Sandbox and AI Gateway
  - `Rivet`
- add lanes as needed
  - `Firecrawl`
  - `Apify`
  - `Parallel`
  - `Prospeo`
  - `AgentMail`
  - `Attio`
  - `Slack` if you want handoff

That is the current happy path. Vercel OAuth is not required for the scaffolded app.

## 5.1. Core capability categories

These are the categories you add/connect against from the CLI:

- `source`
- `search`
- `extract`
- `deep-research`
- `enrichment`
- `crm`
- `email`
- `handoff`
- `state`
- `runtime`
- `model`
- `mcp`

Examples:

```bash
npm run trellis -- add source apify --apply
npm run trellis -- connect source apify
npm run trellis -- add crm attio --apply
npm run trellis -- connect crm attio
```

## 6. Verify

```bash
npm run typecheck
npm test
npm run doctor
npm run dev
```

If you are only verifying local boot and do not have Convex ready yet, use boot-only smoke mode:

```bash
export TRELLIS_LOCAL_SMOKE_MODE=true
export TRELLIS_SANDBOX_TOKEN=local-sandbox-token
export HANDOFF_WEBHOOK_SECRET=local-handoff-secret
npm run doctor
npm run dev
```

Smoke mode boots the dashboard and health check with in-memory repository/state fallbacks. It is not a full workflow runtime.

## 7. Open the operator surface

```text
http://localhost:3000/dashboard
```

To wire the first-party MCP into Claude Code locally:

```bash
npm run trellis -- mcp claude-code --local --write
```

For a hosted demo, connect remote MCP only after the app is reachable at `${APP_URL}` and `/dashboard` is healthy.

## 8. How auth and URLs work

- dashboard login:
  - uses `DASHBOARD_PASSWORD`
  - if unset, falls back to `TRELLIS_SANDBOX_TOKEN`
- remote MCP:
  - endpoint: `${APP_URL}/mcp/trellis`
  - bearer token: `TRELLIS_MCP_TOKEN`
  - fallback token: `TRELLIS_SANDBOX_TOKEN`
- local MCP URL:
  - `http://localhost:3000/mcp/trellis`
- deployed app origin:
  - `APP_URL`
  - on Vercel, if `APP_URL` is unset, the app falls back to `https://$VERCEL_URL`
- webhook URLs:
  - `${APP_URL}/webhooks/apify`
  - `${APP_URL}/webhooks/signals`
  - `${APP_URL}/webhooks/agentmail`

## 9. Use the generated checklist

Every scaffolded project includes:

- `TRELLIS_SETUP.md`
- `packages/` with the local `@trellis/*` workspace packages used by the scaffold

That file is the app-specific onboarding checklist. Start there before enabling discovery, CRM, or outbound email.

Helpful follow-up commands:

```bash
npm run trellis -- connect source apify
npm run trellis -- deploy local
npm run trellis -- mcp claude-code --local --write
```

## 10. Stay safe on first boot

- keep `NO_SENDS_MODE=true`
- confirm `/healthz` returns 200
- confirm dashboard flags resolve
- connect MCP only after dashboard and health checks are healthy
- ingest one normalized signal before enabling live discovery
- confirm the same thread state is visible in the dashboard and through MCP
