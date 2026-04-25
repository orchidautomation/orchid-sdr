# Orchid SDR Reference

This page keeps the implementation and setup detail that does not need to live on the front page.

## Stack

- `RivetKit` for durable actors, scheduling, and actor-local SQLite
- `Hono` for HTTP routing
- `Postgres` as the shared system of record
- `sandbox-agent` + `@vercel/sandbox` for turn-scoped agent execution
- `@ai-sdk/gateway` for structured model calls
- `@modelcontextprotocol/sdk` for the first-party `orchid-sdr` MCP surface
- `Attio` as the optional CRM sync target
- `AgentMail` as the optional outbound and inbound email provider

## Required Env

Minimum local env:

- `DATABASE_URL`
- `NO_SENDS_MODE=true` if you want append-only mode with outbound blocked
- `DEFAULT_CAMPAIGN_TIMEZONE=America/New_York` if you want new campaigns to inherit a local quiet-hours timezone
- `HANDOFF_WEBHOOK_SECRET`
- `ORCHID_SDR_SANDBOX_TOKEN`
- `ORCHID_SDR_MCP_TOKEN` if you want a dedicated token for remote MCP access

For the full sandbox lane:

- `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_KEY`
- Vercel Sandbox auth: `VERCEL_OIDC_TOKEN` or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`
- provider keys such as `APIFY_TOKEN`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `ATTIO_API_KEY`
- discovery config such as `APIFY_LINKEDIN_TASK_ID` or `APIFY_LINKEDIN_ACTOR_ID`
- `DISCOVERY_WEEKDAYS_ONLY=true` if you want discovery to skip weekends (enabled by default)
- `SIGNAL_WEBHOOK_SECRET` if you want to post normalized signals from arbitrary sources

Important runtime notes:

- `APP_URL` must be reachable from Vercel Sandboxes because the sandbox connects back to the repo MCP endpoint.
- `APP_URL` must also be reachable from Apify and AgentMail because they post webhooks into the app.

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

## Campaign Timezones and Quiet Hours

Campaign quiet hours are evaluated in the campaign's local IANA timezone, not UTC.

- each campaign stores a `timezone` value
- new campaigns inherit `DEFAULT_CAMPAIGN_TIMEZONE`
- you can update a live campaign through the first-party MCP tool `control.setCampaignTimezone`
- quiet-hours start/end remain integer hours, but they are interpreted in that campaign-local timezone

Example:

```text
control.setCampaignTimezone({"campaignId":"cmp_default","timezone":"America/New_York"})
```

## Changing the Model

The current default model is `moonshotai/kimi-k2.6`.

There are two places to change it:

- sandbox turns: `src/orchestration/sandbox-broker.ts`
- structured classification / qualification / policy calls: `src/services/ai-service.ts`

When changing models:

- keep the sandbox and structured paths aligned unless you intentionally want different models
- keep routing through Vercel AI Gateway
- rerun `npm run sandbox:probe`, `npm run typecheck`, and `npm test`

## Skills

Tracked AISDR skills live in `skills/`.

Current tracked skills:

- `skills/icp-qualification`
- `skills/research-brief`
- `skills/research-checks`
- `skills/sdr-copy`
- `skills/reply-policy`
- `skills/handoff-policy`

How skills are loaded:

- repo skills from `skills/` are copied into each sandbox session
- local-only skills from `.claude/skills/` are also mounted if they exist, but they are not part of the OSS repo

Recommended pattern:

- put AISDR-specific, reusable behavior in tracked `skills/`
- put personal or vendor/dev-only helper skills in local `.claude/skills/` or ignored folders like `.agents/`

To add a new tracked skill:

1. create `skills/<skill-name>/SKILL.md`
2. keep it focused on one repeatable behavior
3. reference it in the relevant sandbox prompt in `src/orchestration/prospect-workflow.ts`
4. redeploy so new sandbox sessions pick it up

## Knowledge Pack

The markdown files in `knowledge/` are part of the live runtime.

- `knowledge/icp.md`
  Main source of truth for who should qualify.
- `knowledge/product.md`
  What the product is and what it helps with.
- `knowledge/usp.md`
  How the product should be positioned.
- `knowledge/compliance.md`
  Hard safety and policy constraints.
- `knowledge/negative-signals.md`
  Poor-fit cues and disqualifying patterns.
- `knowledge/handoff.md`
  When the agent should escalate to a human.

Practical rule:

- update `icp.md` when you change who should qualify
- update `product.md` when you change what is being sold
- update `usp.md` when you change how it should be framed

If those drift apart, qualification and copy quality drift too.

## MCP

There are two MCP layers:

1. sandbox-mounted MCP servers
2. the first-party `orchid-sdr` MCP server

### Add a Sandbox-Mounted MCP

Sandbox MCP servers are written into `.mcp.json` during sandbox setup in `src/orchestration/sandbox-broker.ts`.

Current defaults:

- `orchid-sdr` first-party MCP
- `parallel-search` via `https://search.parallel.ai/mcp`
- `parallel-task` via `https://task-mcp.parallel.ai/mcp` when `PARALLEL_API_KEY` is set
- `firecrawl` when `FIRECRAWL_API_KEY` is set

Provider MCP tool capabilities are indexed in [MCP Capability Index](mcp-capability-index.md).

To add another one:

1. update the `mcpServers` object written in sandbox setup
2. pass any needed secrets into the sandbox env
3. mention the tool in the relevant prompt or skill

### Add a First-Party `orchid-sdr` Tool

If you want a tool to run through your backend instead of directly hitting a vendor MCP:

1. add the behavior in `src/services/mcp-tools.ts`
2. expose it in `src/mcp/server-factory.ts`
3. back it with an adapter, repository method, or service

Use the first-party MCP for:

- CRM mutations
- stateful internal tools
- provider abstraction
- anything you want behind your own typed boundary

Current `orchid-sdr` tool groups:

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
- `control.setNoSendsMode`
- `control.setCampaignTimezone`

Workflow and actuation tools:

- `knowledge.search`
- `research.search`
- `research.extract`
- `email.enrich`
- `crm.syncProspect`
- `mail.send`
- `mail.reply`
- `mail.pause`
- `mail.preview`
- `handoff.slack`
- `handoff.webhook`

Example remote MCP config:

```json
{
  "mcpServers": {
    "orchid-sdr": {
      "type": "http",
      "url": "https://your-app.example.com/mcp/orchid-sdr",
      "headers": {
        "Authorization": "Bearer ${ORCHID_SDR_MCP_TOKEN}"
      }
    }
  }
}
```

Auth model:

- endpoint: `/mcp/orchid-sdr`
- bearer-token protected
- preferred token: `ORCHID_SDR_MCP_TOKEN`
- fallback token: `ORCHID_SDR_SANDBOX_TOKEN`

See also: `docs/email-providers.md` for the recommended email provider shape for Orchid SDR.

## Attio

There are two clean ways to use Attio with this stack.

### 1. Deterministic app-side sync

This repo exposes `crm.syncProspect` through the first-party MCP. When `ATTIO_API_KEY` is configured, the backend can:

- create or update a company record
- create or update a person record
- link the person to the company
- attach a qualification note to the company
- optionally assert the company into `ATTIO_DEFAULT_LIST_ID`
- optionally set the Attio list status using `ATTIO_DEFAULT_LIST_STAGE`
- optionally set the list entry `main_point_of_contact`
- automatically run that sync after the first outbound using `ATTIO_AUTO_OUTBOUND_STAGE`
- automatically promote the Attio stage after reply classification using `ATTIO_AUTO_POSITIVE_REPLY_STAGE` and `ATTIO_AUTO_NEGATIVE_REPLY_STAGE`

Current Attio flow for a qualified prospect:

1. first outbound can auto-sync the prospect into Attio at `ATTIO_AUTO_OUTBOUND_STAGE`
2. upsert company
3. upsert person linked to the company
4. create a qualification note on the company
5. add the company to the configured AISDR list
6. set the list stage, such as `Prospecting` or `Qualification`
7. set the list entry main point of contact to the synced person
8. later inbound replies can auto-promote the stage based on reply class

Current reply-stage promotion defaults:

- `positive`, `soft_interest`, `objection`, `referral`, `needs_human` -> `ATTIO_AUTO_POSITIVE_REPLY_STAGE`
- `not_now`, `wrong_person`, `unsubscribe`, `bounce`, `spam_risk` -> `ATTIO_AUTO_NEGATIVE_REPLY_STAGE`
- `ooo` -> no automatic stage change

Current idempotency and dedupe order:

1. stored Attio IDs from Postgres
2. email, if present
3. canonical LinkedIn profile URL
4. canonical Twitter/X profile URL
5. exact name plus company as a weak fallback

The first successful sync stores:

Manual operator sync still exists through `crm.syncProspect`. The automatic behavior is just a deterministic wrapper around the same path.

- `prospects.attio_company_record_id`
- `prospects.attio_person_record_id`
- `prospects.attio_list_entry_id`

### 2. Direct Attio MCP

Attio also exposes a hosted remote MCP.

Use that when:

- you want local conversational CRM access
- you want a sandboxed agent to search or inspect your live CRM
- you want direct vendor tooling without wrapping it first

## Normalized Signal Contract

`/webhooks/signals` accepts a normalized signal shape from any source.

It is source-agnostic, but not schema-agnostic. Raw vendor payloads should be mapped into this structure before ingestion.

Example:

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

Why normalize explicitly:

- dedupe needs stable fields
- audits and replays are cleaner
- provider schema drift is isolated to the mapper
- the agent reasons after normalization, not instead of normalization

The raw vendor object can still be preserved under `metadata.raw`.

## Operational Notes

- the sandbox lane is turn-scoped; durable memory lives in Postgres, Rivet actor state, and actor-local SQLite
- only AISDR-specific skills should live in tracked `skills/`
- if `.claude/skills/` exists locally, those skill bundles are also mounted into the sandbox
- the sandbox gets the hosted Parallel Search MCP by default
- if `PARALLEL_API_KEY` is set, Parallel Search MCP gets bearer auth and Parallel Task MCP is mounted for deep research and enrichment
- if `FIRECRAWL_API_KEY` is set, the sandbox gets the hosted Firecrawl MCP
- `discoveryCoordinator` is keyed by `[campaignId, source]` and keeps term frontier and run memory in Rivet SQLite
- Postgres remains the shared CRM and reporting layer
- qualified leads are persisted in Postgres and exposed through the `qualified_leads` view
