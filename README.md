# Orchid SDR on Rivet

This repo implements a sandbox-driven AI SDR control plane on `RivetKit + Hono + Postgres`, with turn-based `sandbox-agent` sessions on Vercel Sandboxes and `moonshotai/kimi-k2.6` routed through Vercel AI Gateway.

## What is here

- `POST /webhooks/apify` for Apify run completions
- `POST /webhooks/signals` for normalized arbitrary-source signal intake
- `POST /webhooks/agentmail` for inbound email handling
- `POST /webhooks/handoff` for machine handoff receipts
- `GET /healthz` for liveness
- `GET /dashboard` for the operator console
- `POST|GET|DELETE /mcp/orchid-sdr` for the first-party MCP server
- `POST /api/rivet/*` for Rivet actor runtime

Core actors:

- `discoveryCoordinator`
- `sourceIngest`
- `prospectThread`
- `campaignOps`
- `sandboxBroker`

Core workflow:

`capture_signal -> qualify -> enrich_email -> build_research_brief -> first_outbound -> await_reply -> classify_reply -> respond_or_handoff -> schedule_followup`

Discovery workflow:

`scheduled discovery tick -> sandbox term planning -> Apify run launch -> /webhooks/apify -> source ingest -> prospect workflow`

Generic intake workflow:

`any normalized source -> /webhooks/signals -> source ingest -> prospect workflow`

## Stack

- `RivetKit` for durable actors, scheduling, and actor-local SQLite
- `Hono` for HTTP routing
- `Postgres` as system of record
- `sandbox-agent` + `@vercel/sandbox` for turn-scoped Claude/Kimi sessions
- `@ai-sdk/gateway` for structured classification/policy calls
- `@modelcontextprotocol/sdk` for the first-party `orchid-sdr` MCP surface

## Required env

Minimum local env:

- `DATABASE_URL`
- `NO_SENDS_MODE=true` if you want append-only mode with all outbound mail blocked at policy time
- `HANDOFF_WEBHOOK_SECRET`
- `ORCHID_SDR_SANDBOX_TOKEN`

For the full sandbox lane:

- `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_KEY`
- Vercel Sandbox auth: `VERCEL_OIDC_TOKEN` or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`
- provider keys such as `APIFY_TOKEN`, `PROSPEO_API_KEY`, `PARALLEL_API_KEY`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `SLACK_WEBHOOK_URL`
- discovery config for the sources you want to run, such as `APIFY_LINKEDIN_TASK_ID` or `APIFY_LINKEDIN_ACTOR_ID`
- `SIGNAL_WEBHOOK_SECRET` if you want to push normalized signals in from arbitrary sources; if omitted, `/webhooks/signals` falls back to `APIFY_WEBHOOK_SECRET`

`APP_URL` must be reachable from Vercel Sandboxes because the sandbox turns connect back to the repo’s remote `orchid-sdr` MCP endpoint.
`APP_URL` must also be reachable from Apify because discovery runs post completion webhooks back into `/webhooks/apify`.

## Commands

```bash
npm install
npm run db:migrate
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
npm run discovery:tick
npm run sandbox:probe
```

## Changing the model

The current default model is `moonshotai/kimi-k2.6`.

There are two places to change it:

- sandbox turns: update `CLAUDE_GATEWAY_MODEL` in [src/orchestration/sandbox-broker.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/aisdk-rivet/src/orchestration/sandbox-broker.ts:19)
- structured classification / qualification / policy calls: update the model slug in [src/services/ai-service.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/aisdk-rivet/src/services/ai-service.ts:59)

When swapping models:

- keep the sandbox and structured paths aligned unless you intentionally want different models for different jobs
- keep using `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_KEY` so routing still goes through Vercel AI Gateway
- rerun `npm run sandbox:probe`, `npm run typecheck`, and `npm test`

## Adding new skills

Tracked AISDR skills live in `skills/`.

Current tracked skills:

- `skills/icp-qualification`
- `skills/research-brief`
- `skills/research-checks`
- `skills/sdr-copy`
- `skills/reply-policy`
- `skills/handoff-policy`

How skills are loaded:

- repo skills from `skills/` are copied into each sandbox session in [src/orchestration/sandbox-broker.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/aisdk-rivet/src/orchestration/sandbox-broker.ts:130)
- local-only skills from `.claude/skills/` are also mounted if they exist, but they are not part of the OSS repo

Recommended pattern:

- put AISDR-specific, reusable behavior in tracked `skills/`
- put personal or vendor/dev-only helper skills in local `.claude/skills/` or ignored folders like `.agents/`

To add a new tracked skill:

1. create `skills/<skill-name>/SKILL.md`
2. keep it focused on one repeatable behavior
3. explicitly reference it in the relevant sandbox prompt in [src/orchestration/prospect-workflow.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/aisdk-rivet/src/orchestration/prospect-workflow.ts:308) or another turn-producing flow
4. redeploy so new sandbox sessions pick it up

## Adding new MCP servers

There are two MCP layers in this repo:

1. sandbox-mounted MCP servers
   these are tools the sandboxed agent can call directly

2. the first-party `orchid-sdr` MCP server
   this is the typed control-plane surface backed by your own adapters and database

### Add a sandbox-mounted MCP

Sandbox MCP servers are written into `.mcp.json` during sandbox setup in [src/orchestration/sandbox-broker.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/aisdk-rivet/src/orchestration/sandbox-broker.ts:101).

That is where the Firecrawl MCP is currently mounted.

To add another one:

1. update the `mcpServers` object written in `prepareSandboxWorkspace(...)`
2. pass any needed secrets into the sandbox env in `createVercelSandboxProvider(...)`
3. mention the tool in the relevant prompt or skill so the agent knows when to use it

### Add a first-party `orchid-sdr` tool

If you want the agent to call a tool through your own backend instead of talking to a vendor MCP directly:

1. add the behavior in [src/services/mcp-tools.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/aisdk-rivet/src/services/mcp-tools.ts:1)
2. expose it in [src/mcp/server-factory.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/aisdk-rivet/src/mcp/server-factory.ts:1)
3. back it with an adapter, repository method, or service as needed

Use the first-party MCP for:

- CRM mutations
- stateful internal tools
- provider abstraction
- anything you want to keep behind your own typed boundary

Use direct vendor MCPs for:

- sandbox-native research tools
- tools that benefit from direct agent interaction
- fast experiments where you do not need a control-plane wrapper yet

Dashboard notes:

- `GET /` redirects to `/dashboard`
- the dashboard is password-protected with `DASHBOARD_PASSWORD` or falls back to `ORCHID_SDR_SANDBOX_TOKEN`
- long sandbox work is queued through `sandboxBroker.enqueueTurn`, so manual probes do not block on HTTP request timeouts
- manual discovery uses `discoveryCoordinator.enqueueTick`, which schedules a near-immediate tick instead of waiting on a full discovery pass in the request/response cycle

Generic signal webhook example:

```json
{
  "provider": "custom-source",
  "source": "reddit_post",
  "externalId": "batch_123",
  "signals": [
    {
      "url": "https://example.com/post/1",
      "authorName": "Jane Doe",
      "authorTitle": "Head of RevOps",
      "authorCompany": "Northstar",
      "companyDomain": "northstar.ai",
      "topic": "signal-based outbound",
      "content": "We are rebuilding our GTM workflow stack around agentic tooling."
    }
  ]
}
```

## Notes

- The sandbox lane is intentionally turn-scoped. Durable memory lives in Postgres, Rivet actor state, and actor-local SQLite, not in a warm sandbox.
- The agent only sees first-party MCP tools. Vendor APIs stay behind adapters in the control plane.
- The repo-managed `knowledge/` and `skills/` directories are copied into each sandbox session before prompting.
- Only AISDR-specific skills should live in the tracked `skills/` directory. Local dev/vendor helper skills should live under ignored folders like `.agents/` so they are not shipped as part of OSS.
- If `.claude/skills/` exists locally, those skill bundles are also copied into each sandbox session and exposed alongside the repo `skills/` directory.
- If `FIRECRAWL_API_KEY` is set, the sandbox also gets the official hosted Firecrawl MCP wired in at `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` with no local `npx` install required.
- `discoveryCoordinator` is keyed by `[campaignId, source]` and keeps per-source term frontier, run history, and yield memory in Rivet SQLite. Postgres remains the shared CRM/system-of-record.
- Qualified leads are persisted in Postgres with `prospects.is_qualified`, `prospects.qualified_at`, and `prospects.qualification_reason`. Use the `qualified_leads` view for analysis.
