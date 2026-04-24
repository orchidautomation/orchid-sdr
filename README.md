# Orchid SDR on Rivet

This repo implements a sandbox-driven AI SDR control plane on `RivetKit + Hono + Postgres`, with turn-based `sandbox-agent` sessions on Vercel Sandboxes and `moonshotai/kimi-k2.6` routed through Vercel AI Gateway.

Further reading:

- [The AI SDR market is broken](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/docs/blog/the-ai-sdr-market-is-broken.md)

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
- `Attio` as the optional CRM system-of-record sync target

## Required env

Minimum local env:

- `DATABASE_URL`
- `NO_SENDS_MODE=true` if you want append-only mode with all outbound mail blocked at policy time
- `HANDOFF_WEBHOOK_SECRET`
- `ORCHID_SDR_SANDBOX_TOKEN`
- `ORCHID_SDR_MCP_TOKEN` if you want a dedicated token for remote MCP access; if omitted, the MCP falls back to `ORCHID_SDR_SANDBOX_TOKEN`

For the full sandbox lane:

- `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_KEY`
- Vercel Sandbox auth: `VERCEL_OIDC_TOKEN` or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`
- provider keys such as `APIFY_TOKEN`, `PROSPEO_API_KEY`, `PARALLEL_API_KEY`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `SLACK_WEBHOOK_URL`
- optional CRM sync: `ATTIO_API_KEY`, and optionally `ATTIO_DEFAULT_LIST_ID` if you want the sync tool to add companies into an Attio pipeline list and `ATTIO_DEFAULT_LIST_STAGE` if you want a default stage like `Qualification`
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

- sandbox turns: update `CLAUDE_GATEWAY_MODEL` in [src/orchestration/sandbox-broker.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/src/orchestration/sandbox-broker.ts:19)
- structured classification / qualification / policy calls: update the model slug in [src/services/ai-service.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/src/services/ai-service.ts:59)

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

- repo skills from `skills/` are copied into each sandbox session in [src/orchestration/sandbox-broker.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/src/orchestration/sandbox-broker.ts:130)
- local-only skills from `.claude/skills/` are also mounted if they exist, but they are not part of the OSS repo

Recommended pattern:

- put AISDR-specific, reusable behavior in tracked `skills/`
- put personal or vendor/dev-only helper skills in local `.claude/skills/` or ignored folders like `.agents/`

To add a new tracked skill:

1. create `skills/<skill-name>/SKILL.md`
2. keep it focused on one repeatable behavior
3. explicitly reference it in the relevant sandbox prompt in [src/orchestration/prospect-workflow.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/src/orchestration/prospect-workflow.ts:308) or another turn-producing flow
4. redeploy so new sandbox sessions pick it up

## Knowledge pack

The markdown files in `knowledge/` are part of the live runtime, not just docs.

They feed qualification, research, and drafting in the sandbox:

- [knowledge/icp.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/knowledge/icp.md)
  - who should qualify
  - company and persona fit
  - pains, triggers, positive signals, negative signals
  - this is the main source of truth for ICP matching
- [knowledge/product.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/knowledge/product.md)
  - what the product actually is
  - what it helps with
  - the operational framing the drafter should use
- [knowledge/usp.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/knowledge/usp.md)
  - how the product should be positioned
  - what differentiators to emphasize
  - what angles should show up in copy and handoff context
- [knowledge/compliance.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/knowledge/compliance.md)
  - hard safety and policy constraints for outreach
  - what the agent must not fabricate or imply
- [knowledge/negative-signals.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/knowledge/negative-signals.md)
  - additional poor-fit cues and disqualifying patterns
- [knowledge/handoff.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/knowledge/handoff.md)
  - when the agent should stop and escalate to a human
  - what context a human should receive at handoff time

Practical rule:

- update `icp.md` when you change who should qualify
- update `product.md` when you change what is being sold
- update `usp.md` when you change how it should be framed

If those three drift apart, qualification and copy quality will drift too.

## Adding new MCP servers

There are two MCP layers in this repo:

1. sandbox-mounted MCP servers
   these are tools the sandboxed agent can call directly

2. the first-party `orchid-sdr` MCP server
   this is the typed control-plane surface backed by your own adapters and database

### Add a sandbox-mounted MCP

Sandbox MCP servers are written into `.mcp.json` during sandbox setup in [src/orchestration/sandbox-broker.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/src/orchestration/sandbox-broker.ts:101).

That is where the Firecrawl MCP is currently mounted.

To add another one:

1. update the `mcpServers` object written in `prepareSandboxWorkspace(...)`
2. pass any needed secrets into the sandbox env in `createVercelSandboxProvider(...)`
3. mention the tool in the relevant prompt or skill so the agent knows when to use it

### Add a first-party `orchid-sdr` tool

If you want the agent to call a tool through your own backend instead of talking to a vendor MCP directly:

1. add the behavior in [src/services/mcp-tools.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/src/services/mcp-tools.ts:1)
2. expose it in [src/mcp/server-factory.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/src/mcp/server-factory.ts:1)
3. back it with an adapter, repository method, or service as needed

Use the first-party MCP for:

- CRM mutations
- stateful internal tools
- provider abstraction
- anything you want to keep behind your own typed boundary

Current `orchid-sdr` tools are grouped like this:

Operator and pipeline tools:

- `pipeline.summary`
- `pipeline.activeThreads`
- `pipeline.qualifiedLeads`
- `pipeline.providerRuns`
- `pipeline.failures`
- `pipeline.workflowFeed`
- `lead.getContext`
- `lead.inspect`
- `lead.updateState`
- `thread.inspect`
- `runtime.discovery`
- `runtime.discoveryHealth`
- `runtime.sandboxJobs`
- `runtime.flags`
- `control.runDiscovery`

Workflow and actuation tools:

- `knowledge.search`
- `research.search`
- `research.extract`
- `email.enrich`
- `crm.syncProspect`
- `mail.send`
- `mail.reply`
- `mail.pause`
- `handoff.slack`
- `handoff.webhook`

That means a local MCP client can ask questions like "what does my pipeline look like?", "why is this prospect paused?", or "run discovery now" without scraping the dashboard HTML.

Example remote MCP config:

```json
{
  "mcpServers": {
    "orchid-sdr": {
      "type": "http",
      "url": "https://orchid-sdr-production.up.railway.app/mcp/orchid-sdr",
      "headers": {
        "Authorization": "Bearer ${ORCHID_SDR_MCP_TOKEN}"
      }
    }
  }
}
```

Auth model:

- the MCP endpoint is `https://<your-app>/mcp/orchid-sdr`
- access is bearer-token protected
- use `ORCHID_SDR_MCP_TOKEN` as the preferred dedicated token
- if `ORCHID_SDR_MCP_TOKEN` is unset, the server falls back to `ORCHID_SDR_SANDBOX_TOKEN`

For an open-source deployment, the normal setup is:

1. deploy the app somewhere public, such as Railway
2. set `APP_URL` to that public URL
3. set `ORCHID_SDR_MCP_TOKEN`
4. point your local MCP client at `/mcp/orchid-sdr` with `Authorization: Bearer <token>`

Once mounted, a local assistant can ask:

- "What does my pipeline look like?"
- "Show active threads."
- "Show recent provider failures."
- "Inspect this prospect and tell me why it qualified."
- "Run discovery now for LinkedIn."
- "Sync this qualified prospect to Attio."

## Attio

There are two clean ways to use Attio with this stack.

### 1. Deterministic app-side sync

This repo now exposes `crm.syncProspect` through the first-party `orchid-sdr` MCP. When `ATTIO_API_KEY` is configured, the backend can:

- create or update a company record
- create or update a person record
- link the person to the company
- attach a CRM note with qualification + research context to the company
- optionally assert the company into `ATTIO_DEFAULT_LIST_ID`
- optionally set the Attio list status using `ATTIO_DEFAULT_LIST_STAGE` or a per-call `listStage`
- optionally set the Attio list entry `main_point_of_contact`

This is the right mode for production workflow steps because the sync stays inside your typed control plane.

Current Attio flow for a qualified prospect:

1. upsert company
2. upsert person linked to the company
3. create a qualification note on the company
4. add the company to the configured AISDR list
5. set the list stage, such as `Qualification`
6. set the list entry main point of contact to the synced person

Current idempotency and dedupe order:

1. stored Attio IDs from Postgres
2. email, if present
3. canonical LinkedIn profile URL
4. canonical Twitter/X profile URL
5. exact name plus company as a weak fallback

The first successful sync stores:

- `prospects.attio_company_record_id`
- `prospects.attio_person_record_id`
- `prospects.attio_list_entry_id`

That means later syncs can update the exact Attio records by ID instead of relying on fuzzy matching.

### 2. Direct Attio MCP for local or sandbox-native workflows

Attio also exposes a hosted remote MCP at `https://mcp.attio.com/mcp`.

That is a good fit when:

- you want local conversational CRM access
- you want a sandboxed agent to search or inspect your live CRM
- you want OAuth instead of managing an API key

Because this repo already uses a Claude-style harness, adding the hosted Attio MCP to `.mcp.json` later is straightforward.

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

The important boundary is that `/webhooks/signals` accepts a normalized signal shape from any source. It is source-agnostic, but not schema-agnostic: raw vendor payloads should be mapped into this structure before ingestion.

## Notes

- The sandbox lane is intentionally turn-scoped. Durable memory lives in Postgres, Rivet actor state, and actor-local SQLite, not in a warm sandbox.
- The agent only sees first-party MCP tools. Vendor APIs stay behind adapters in the control plane.
- The repo-managed `knowledge/` and `skills/` directories are copied into each sandbox session before prompting.
- Only AISDR-specific skills should live in the tracked `skills/` directory. Local dev/vendor helper skills should live under ignored folders like `.agents/` so they are not shipped as part of OSS.
- If `.claude/skills/` exists locally, those skill bundles are also copied into each sandbox session and exposed alongside the repo `skills/` directory.
- If `FIRECRAWL_API_KEY` is set, the sandbox also gets the official hosted Firecrawl MCP wired in at `https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp` with no local `npx` install required.
- `discoveryCoordinator` is keyed by `[campaignId, source]` and keeps per-source term frontier, run history, and yield memory in Rivet SQLite. Postgres remains the shared CRM/system-of-record.
- Qualified leads are persisted in Postgres with `prospects.is_qualified`, `prospects.qualified_at`, and `prospects.qualification_reason`. Use the `qualified_leads` view for analysis.
- `signals` and `prospects` store canonical social identity where available, including `linkedin_url` and `twitter_url`.
- The `qualified_leads` view now includes `twitter_url` so downstream analysis and CRM sync can use the same identity surface.
