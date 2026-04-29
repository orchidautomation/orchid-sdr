# Convex + Vercel Prod Runbook

This is the shortest exact path for deploying the Trellis AI SDR reference app to:

- Convex Cloud for state
- Vercel for the app surface

This runbook assumes:

- you are deploying the reference app already in this repo
- you want a safe prod demo first
- `NO_SENDS_MODE=true`

## Target Shape

```text
Convex Cloud        state
Vercel              app host
Rivet               actor runtime
Vercel Sandbox      isolated agent execution
Vercel AI Gateway   model routing
Firecrawl           research
```

Useful optional providers later:

```text
Apify      discovery
Prospeo    enrichment
Attio      CRM
AgentMail  outbound + replies
Slack      handoff
```

## 1. Local Prerequisites

From the repo root:

```bash
nvm use 22
npm install
cp .env.example .env.local
```

Required local proof before prod:

1. `npx convex dev`
2. `npm run dev`
3. `npm run trellis:demo:check -- --base-url http://localhost:3000 --dashboard-password dev --mcp-token "$TRELLIS_MCP_TOKEN" --signal-secret "$SIGNAL_WEBHOOK_SECRET"`

If that fails, do not deploy yet.

## 2. Create Or Select The Convex Deployment

If you do not already have the target deployment:

```bash
npx convex dev
```

That will provision or attach a deployment and keep functions synced.

For production deploy:

```bash
npx convex deploy
```

Keep these env values:

```bash
CONVEX_DEPLOYMENT=<your-deployment-slug>
CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_SITE_URL=https://<your-deployment>.convex.site
```

If `npx convex deploy` fails on schema validation against old prod data, do not leave the final schema loose. Use a staged migration:

1. temporarily loosen only the legacy fields that are blocking deploy
2. deploy that temporary migration shape
3. backfill the old rows
4. restore the strict schema
5. deploy again

The final Trellis branch should stay strict.

## 3. Set The Minimum Production Env

You need these values in Vercel:

```bash
APP_URL=https://<your-vercel-domain>
DASHBOARD_PASSWORD=<long-random-password>
TRELLIS_SANDBOX_TOKEN=<long-random-secret>
TRELLIS_MCP_TOKEN=<long-random-secret>
SIGNAL_WEBHOOK_SECRET=<long-random-secret>
HANDOFF_WEBHOOK_SECRET=<long-random-secret>
NO_SENDS_MODE=true
DEFAULT_CAMPAIGN_TIMEZONE=America/New_York

CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud

RIVET_ENDPOINT=<your-rivet-endpoint>
RIVET_TOKEN=<your-rivet-token>

FIRECRAWL_API_KEY=<your-firecrawl-key>
AI_GATEWAY_API_KEY=<your-gateway-key>
```

If you use Vercel Sandbox, also set either:

```bash
VERCEL_OIDC_TOKEN=<token>
```

or:

```bash
VERCEL_TOKEN=<token>
VERCEL_TEAM_ID=<team-id>
VERCEL_PROJECT_ID=<project-id>
```

Optional discovery lane env:

```bash
APIFY_TOKEN=<token>
APIFY_LINKEDIN_ACTOR_ID=harvestapi/linkedin-post-search
APIFY_LINKEDIN_POSTS_ACTOR_ID=supreme_coder/linkedin-post
APIFY_LINKEDIN_PROFILE_ACTOR_ID=harvestapi/linkedin-profile-scraper
APIFY_WEBHOOK_SECRET=<long-random-secret>
DISCOVERY_LINKEDIN_ENABLED=true
```

## 4. Link Vercel

From the repo root:

```bash
vercel login
vercel link
```

Then set env in Vercel.

The app must use the Convex prod URL after `npx convex deploy`, not the local dev deployment URL.

If you want to push env from local files one by one, use:

```bash
vercel env add
```

If you want to pull the current Vercel env locally to verify what is set:

```bash
vercel env pull .env.vercel
```

## 5. Deploy To Vercel Prod

From the repo root:

```bash
vercel --prod
```

After deploy, set:

```bash
APP_URL=https://<the-final-vercel-domain>
```

If the production URL changed, redeploy once after fixing `APP_URL`.

## 6. Verify The Hosted App

Run:

```bash
curl -fsS https://<your-vercel-domain>/healthz
```

Open:

```text
https://<your-vercel-domain>/dashboard
```

Log in with:

```text
<DASHBOARD_PASSWORD>
```

Then run:

```bash
npm run trellis:demo:check -- \
  --base-url "https://<your-vercel-domain>" \
  --dashboard-password "$DASHBOARD_PASSWORD" \
  --mcp-token "$TRELLIS_MCP_TOKEN" \
  --signal-secret "$SIGNAL_WEBHOOK_SECRET"
```

Success means:

- `healthz` ok
- `dashboard` ok
- `mcp` ok
- `signal` ok

## 7. Connect Remote MCP

After hosted verification:

```bash
npm run trellis -- mcp claude-code --remote --write --url "https://<your-vercel-domain>/mcp/trellis" --token "$TRELLIS_MCP_TOKEN"
```

Swap `claude-code` for:

- `cursor`
- `codex`
- `opencode`

## 8. Safe Demo Sequence

Keep the first prod proof constrained:

1. `NO_SENDS_MODE=true`
2. run hosted `trellis:demo:check`
3. inspect the signal and prospect in `/dashboard`
4. inspect the same state through MCP
5. only then enable discovery cadence, CRM writes, or outbound sends

## 9. What Not To Do

Do not:

- deploy before `npm run doctor` is clean enough for the lanes you actually enabled
- use smoke mode as proof of hosted readiness
- connect remote MCP before `/dashboard` and `/healthz` work
- turn on outbound email for the first prod proof

## 10. The Exact Two-Terminal Local Pattern

When debugging the real Convex-backed app locally, use:

Terminal 1:

```bash
nvm use 22
npx convex dev
```

Terminal 2:

```bash
nvm use 22
npm run dev
```

If you only want local boot verification without Convex-backed runtime behavior:

```bash
TRELLIS_LOCAL_SMOKE_MODE=true npm run dev
```
