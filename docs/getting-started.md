# Getting Started

This is the shortest path to a working Trellis reference app.

If your goal is one demo, use the reference AI SDR already in this repo before scaffolding a custom app.

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
- `FIRECRAWL_API_KEY`
- `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_KEY`
- `NO_SENDS_MODE=true`

Then run:

```bash
npm run typecheck
npm test
npm run doctor
npm run dev
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
npm run ai-sdr -- init ../trellis-core --name trellis-core
```

That command scaffolds the base Trellis runtime by default.

After boot, add capabilities incrementally:

```bash
npm run ai-sdr -- add source apify --apply
npm run ai-sdr -- add deep-research parallel --apply
npm run ai-sdr -- add enrichment prospeo --apply
```

Choose lanes directly with flags:

```bash
npm run ai-sdr -- init ../trellis-core-plus --name trellis-core-plus --with-discovery --with-deep-research
```

The CLI no longer owns a guided wizard. Guided onboarding should sit on top of the CLI, not inside it.
When an agent or plugin is driving setup, use the JSON contract:

```bash
npm run ai-sdr -- init ../trellis-core --name trellis-core --json
npm run doctor -- --json
npm run ai-sdr -- connect source apify --json
npm run ai-sdr -- deploy local --json
npm run ai-sdr -- mcp claude-code --local --write --json
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
  - `Firecrawl`
  - `Rivet`
- add lanes as needed
  - `Apify`
  - `Parallel`
  - `Prospeo`
  - `AgentMail`
  - `Attio`
  - `Slack` if you want handoff

That is the current happy path. Vercel OAuth is not required for the scaffolded app.

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
npm run ai-sdr -- mcp claude-code --local --write
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
- `packages/` with the local `@ai-sdr/*` workspace packages used by the scaffold

That file is the app-specific onboarding checklist. Start there before enabling discovery, CRM, or outbound email.

Helpful follow-up commands:

```bash
npm run ai-sdr -- connect source apify
npm run ai-sdr -- deploy local
npm run ai-sdr -- mcp claude-code --local --write
```

## 10. Stay safe on first boot

- keep `NO_SENDS_MODE=true`
- confirm `/healthz` returns 200
- confirm dashboard flags resolve
- connect MCP only after dashboard and health checks are healthy
- ingest one normalized signal before enabling live discovery
- confirm the same thread state is visible in the dashboard and through MCP
