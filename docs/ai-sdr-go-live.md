# AI SDR Go-Live

This is the canonical path for getting one Trellis AI SDR demo live with the least confusion.

Use this when you want one safe hosted deployment, one MCP connection, and one ingested signal before enabling any autonomous behavior.

## Goal

Get the reference AI SDR to a deployed state where:

- `/healthz` is healthy
- `/dashboard` loads
- remote MCP works
- discovery or warm inbound can enter the system
- sends are still safe by default

This document assumes:

- you are using the reference app in `examples/ai-sdr/`
- you are not building a custom Trellis app yet
- you are proving one demo path, not every optional lane

## Deployment Mode

Start in:

- `NO_SENDS_MODE=true`

Do not begin with autonomous outbound.

The first production proof should be:

- live deployment
- real provider wiring
- real ingestion
- reviewable state and drafts
- outbound still blocked until verified

## Demo Order

Follow this order exactly:

1. fill core env
2. run `npm run doctor`
3. deploy the app
4. verify `/healthz`
5. log into `/dashboard`
6. connect remote MCP
7. ingest one signal
8. verify state, research, and draft output
9. only then enable discovery cadence, CRM writes, or email sends

## Minimum Stack

The minimum practical hosted stack for the current AI SDR example is:

```text
Convex            state plane
Rivet             actor runtime
Vercel Sandbox    isolated agent execution
Vercel AI Gateway model routing
Firecrawl         search + extract
```

Useful next providers:

```text
Apify      discovery
Prospeo    enrichment
Attio      CRM sync
AgentMail  outbound + replies
Slack      handoff
```

## 1. Clone And Install

```bash
git clone https://github.com/orchidautomation/trellis.git
cd trellis
npm install
cp .env.example .env
```

## 2. Set Minimum Env

Treat the env block in three groups.

### Core app identity and auth

Required:

```bash
APP_URL=https://your-app.example.com
HANDOFF_WEBHOOK_SECRET=<long-random-secret>
TRELLIS_SANDBOX_TOKEN=<long-random-secret>
TRELLIS_MCP_TOKEN=<long-random-secret>
DASHBOARD_PASSWORD=<long-random-password>
NO_SENDS_MODE=true
DEFAULT_CAMPAIGN_TIMEZONE=America/New_York
```

### Core runtime

Required:

```bash
CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
RIVET_ENDPOINT=<your-rivet-endpoint>
RIVET_TOKEN=<your-rivet-token>
```

### Core research and model routing

Required:

```bash
FIRECRAWL_API_KEY=<your-firecrawl-key>
AI_GATEWAY_API_KEY=<your-gateway-key>
```

### Sandbox auth

If using Vercel Sandbox, also set either:

```bash
VERCEL_OIDC_TOKEN=<token>
```

or:

```bash
VERCEL_TOKEN=<token>
VERCEL_TEAM_ID=<team-id>
VERCEL_PROJECT_ID=<project-id>
```

Do not start with discovery, CRM, Slack, or email env unless you are actually planning to demo those lanes.

## 3. Verify Local Readiness

```bash
npm run typecheck
npm test
npm run doctor
```

Do not deploy until `doctor` is green for the lanes you intend to demo.

## 4. Customize The Knowledge Pack

Before going live, update:

- `examples/ai-sdr/knowledge/icp.md`
- `examples/ai-sdr/knowledge/product.md`
- `examples/ai-sdr/knowledge/usp.md`
- `examples/ai-sdr/knowledge/compliance.md`
- `examples/ai-sdr/knowledge/negative-signals.md`
- `examples/ai-sdr/knowledge/handoff.md`

Then review:

- `examples/ai-sdr/skills/icp-qualification`
- `examples/ai-sdr/skills/research-brief`
- `examples/ai-sdr/skills/research-checks`
- `examples/ai-sdr/skills/sdr-copy`
- `examples/ai-sdr/skills/reply-policy`
- `examples/ai-sdr/skills/handoff-policy`

Do this before live ingestion. Otherwise the demo will run against placeholder ICP and product context.

## 5. Deploy The App

If deploying the reference app as-is:

```bash
npm run build
npm start
```

Or run it behind your hosting layer with Docker:

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

You can also use Vercel for the app surface if that is your preferred host, but the core requirement is simple:

- your app must be reachable at `APP_URL`
- webhooks must be able to hit it
- Vercel Sandboxes must be able to call back to it

## 6. Verify The Live Surface

Check:

```bash
curl -fsS https://your-app.example.com/healthz
```

Open:

```text
https://your-app.example.com/dashboard
```

Verify remote MCP against:

```text
https://your-app.example.com/mcp/trellis
```

The dashboard must work before you connect MCP. If `/dashboard` is not healthy yet, do not debug through MCP first.

## 7. Connect Remote MCP

Use this shape:

```json
{
  "mcpServers": {
    "trellis": {
      "type": "http",
      "url": "https://your-app.example.com/mcp/trellis",
      "headers": {
        "Authorization": "Bearer ${TRELLIS_MCP_TOKEN}"
      }
    }
  }
}
```

Start with read-only tools:

- `pipeline.summary`
- `runtime.flags`
- `knowledge.search`

Do not start by invoking write-heavy tools. First prove that the control plane can read consistent state.

## 8. Wire Ingestion

### Warm inbound or custom signals

```text
POST https://your-app.example.com/webhooks/signals?secret=<SIGNAL_WEBHOOK_SECRET>
```

This is the safest first live demo path. Use one known, hand-crafted normalized signal before enabling any discovery scheduler.

### Apify discovery

Set:

```bash
APIFY_TOKEN=<token>
APIFY_LINKEDIN_TASK_ID=<task-id>
APIFY_WEBHOOK_SECRET=<long-random-secret>
DISCOVERY_LINKEDIN_ENABLED=true
DISCOVERY_LINKEDIN_SEED_TERMS=revops,gtm engineering,ai workflows
```

Webhook:

```text
POST https://your-app.example.com/webhooks/apify?secret=<APIFY_WEBHOOK_SECRET>
```

## 9. First Safe Live Test

The first real test should be:

1. keep `NO_SENDS_MODE=true`
2. ingest one known signal
3. confirm prospect state is written
4. confirm research brief exists
5. confirm draft exists if that lane is enabled
6. confirm MCP and dashboard show the same state
7. confirm no email or CRM mutation escaped the safety rails

Only after that should you turn on:

- real discovery at cadence
- CRM mutation
- outbound sending

## 10. Optional Full AI SDR Stack

If you want the fuller reference shape, add:

```bash
APIFY_LINKEDIN_PROFILE_TASK_ID=<task-id>
PROSPEO_API_KEY=<key>
ATTIO_API_KEY=<key>
AGENTMAIL_API_KEY=<key>
AGENTMAIL_WEBHOOK_SECRET=<secret>
SLACK_BOT_TOKEN=<token>
```

## Success Condition

The AI SDR is live when:

- the app is healthy
- dashboard is reachable
- remote MCP is reachable
- at least one real signal can enter
- state persists correctly
- drafts or actions are reviewable
- sends remain controlled until you intentionally enable them

## What Still Commonly Blocks A Demo

These are the remaining practical blockers once the code is in place:

1. missing or mismatched core env
   - `APP_URL`
   - `CONVEX_URL`
   - `RIVET_ENDPOINT`
   - `RIVET_TOKEN`
   - `FIRECRAWL_API_KEY`
   - `AI_GATEWAY_API_KEY`
2. deploying before `doctor` is clean enough
3. connecting MCP before the dashboard and health checks are healthy
4. enabling discovery before manual signal ingest is proven
5. turning off `NO_SENDS_MODE` too early
