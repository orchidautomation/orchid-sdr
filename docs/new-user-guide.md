# Trellis New User Guide

This guide covers the Trellis reference AI SDR from a product and implementation perspective:

- what Trellis includes
- which core and optional lanes are available
- what accounts and environment variables are required
- how to run the app locally
- how to extend the stack
- how to deploy it

If you are trying to get one demo live, use this order:

1. fill the core env
2. keep `NO_SENDS_MODE=true`
3. run `npm run doctor`
4. deploy the app
5. verify `/healthz` and `/dashboard`
6. connect remote MCP
7. ingest one known signal
8. verify state, research, and draft output before enabling any send lane

## What Trellis Is

Trellis is a framework for composing agentic GTM systems. This repository includes:

1. a reference AI SDR application
2. the framework packages and contracts that support it

The reference app provides a working control plane for signal ingestion, research, qualification, workflow state, dashboard operations, and MCP access.

## What The Reference App Does

At a high level, the AI SDR workflow:

1. ingests normalized signals
2. researches the person, company, and source context
3. qualifies the lead against the repo knowledge pack
4. persists workflow state
5. exposes pipeline state through the dashboard and MCP server
6. optionally syncs CRM, drafts email, handles replies, and routes handoff

Core capabilities:

- normalized inbound signal ingest through webhooks
- optional scheduled discovery from public sources such as LinkedIn
- web research for person and company context
- Convex-backed state and audit history
- Rivet orchestration
- dashboard and first-party MCP control surfaces

Optional capabilities:

- enrichment
- Attio CRM sync
- AgentMail outbound and reply handling
- Slack handoff

## Recommended Demo Shape

For one credible demo, do not start with every optional lane.

Start with:

- normalized signal ingest
- Firecrawl for search and extraction
- Convex for state
- Rivet for orchestration
- Vercel Sandbox for agent execution
- Vercel AI Gateway for model routing
- the first-party MCP server

Then add only what you plan to show:

- `Apify` for scheduled discovery
- `Prospeo` for enrichment
- `Attio` for CRM sync
- `AgentMail` for outbound and replies
- `Slack` for handoff

That is also the Trellis scaffold rule now:

- `npm run trellis -- init ...` always gives you the core app
- optional lanes are added explicitly with `--with-*`, `add`, and `connect`

The public capability categories are:

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

The safest first demo keeps `NO_SENDS_MODE=true` and proves:

- one signal entered
- one thread persisted
- one research brief exists
- one draft exists, if outbound is enabled
- MCP and dashboard agree on state

### Model Routing

Model routing is configured in `ai-sdr.config.ts`.

- `modelRouting.defaultModel` sets the global fallback.
- `modelRouting.sandbox.defaultModel` sets the default model for sandbox agent turns.
- `modelRouting.sandbox.stages` can override per-stage models for discovery, qualification, research briefing, outbound drafting, reply classification, and handoff handling.
- `modelRouting.structured` can override models used for structured operations such as reply classification, policy checks, and prospect qualification.

This allows a deployment to mix lower-cost drafting models with stronger reasoning models for research or qualification.

## Required Accounts And Secrets

### Core Dependencies

#### Convex

Role:

- operational state plane
- source of record for the reference app
- dashboard and workflow backing store

Typical environment variables:

- `CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- optional `CONVEX_DEPLOYMENT`
- optional `CONVEX_DEPLOY_KEY`

#### Vercel

Role:

- Sandbox execution
- AI Gateway model routing
- optional hosted deployment target

Typical Sandbox auth:

- `VERCEL_OIDC_TOKEN`
- or `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`

Model routing keys:

- `AI_GATEWAY_API_KEY`
- or `VERCEL_AI_GATEWAY_KEY`

#### Firecrawl

Role:

- primary search
- primary extraction

Required:

- `FIRECRAWL_API_KEY`

#### Rivet

Role:

- actor orchestration
- workflow scheduling
- runtime control plane

Typical variables:

- `RIVET_ENDPOINT`
- `RIVET_TOKEN`
- `RIVET_PROJECT`
- `RIVET_ENV`
- optional `RIVET_PUBLIC_ENDPOINT`
- optional `RIVET_PUBLIC_TOKEN`

#### App Secrets

Required:

- `APP_URL`
- `TRELLIS_SANDBOX_TOKEN`
- `HANDOFF_WEBHOOK_SECRET`

Recommended:

- `TRELLIS_MCP_TOKEN`
- `DASHBOARD_PASSWORD`

### Additional Dependencies By Optional Lane

- `Apify`
  - `APIFY_TOKEN`
  - `APIFY_LINKEDIN_TASK_ID` or `APIFY_LINKEDIN_ACTOR_ID`
  - `APIFY_WEBHOOK_SECRET`
  - optional `APIFY_LINKEDIN_PROFILE_TASK_ID` or `APIFY_LINKEDIN_PROFILE_ACTOR_ID`
- `Parallel`
  - `PARALLEL_API_KEY`
- `Prospeo`
  - `PROSPEO_API_KEY`
- `Attio`
  - `ATTIO_API_KEY`
- `AgentMail`
  - `AGENTMAIL_API_KEY`
  - `AGENTMAIL_WEBHOOK_SECRET`
- `Slack`
  - `SLACK_BOT_TOKEN` and/or `SLACK_WEBHOOK_URL`

## Run It Locally

If the repo is configured correctly, the standard local flow is:

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run doctor
npm run dev
```

Open the dashboard at:

```text
http://localhost:3000/dashboard
```

If Convex is not available and you only need a local boot check, use smoke mode:

```bash
export TRELLIS_LOCAL_SMOKE_MODE=true
export TRELLIS_SANDBOX_TOKEN=local-sandbox-token
export HANDOFF_WEBHOOK_SECRET=local-handoff-secret
npm run doctor
npm run dev
```

Smoke mode is limited to boot and dashboard verification.

### Expected First-Boot Behavior

- the app starts locally
- `/dashboard` resolves
- `/healthz` returns `200`
- dashboard data may take a few seconds to populate on the first load

### Auth Model

Dashboard auth:

- route: `/dashboard`
- password source: `DASHBOARD_PASSWORD`
- fallback: `TRELLIS_SANDBOX_TOKEN`

MCP auth:

- route: `/mcp/trellis`
- bearer token: `TRELLIS_MCP_TOKEN`
- fallback: `TRELLIS_SANDBOX_TOKEN`

### URL Derivation

Local URLs:

- dashboard: `http://localhost:3000/dashboard`
- MCP: `http://localhost:3000/mcp/trellis`

Deployment URLs:

- dashboard: `${APP_URL}/dashboard`
- MCP: `${APP_URL}/mcp/trellis`
- webhooks: `${APP_URL}/webhooks/...`

Set `APP_URL` explicitly for deployed environments. On Vercel, the app falls back to `https://$VERCEL_URL` when `APP_URL` is unset.

## Recommended Enablement Path

For a new deployment:

1. start from the current reference AI SDR
2. connect Convex, Vercel, Firecrawl, and Rivet
3. set `NO_SENDS_MODE=true`
4. run `npm run doctor`
5. deploy or run locally
6. open the dashboard and verify `/healthz`
7. connect MCP and verify read-only tools first
8. send one known signal into `/webhooks/signals`
9. inspect leads and workflow state
10. add discovery, enrichment, CRM, and outbound only after the pipeline is stable

## Extend The System

### Add Providers

Add optional providers through the CLI:

```bash
npm run trellis -- add source apify --apply
npm run trellis -- add deep-research parallel --apply
npm run trellis -- add enrichment prospeo --apply
```

For operator-triggered discovery:

```bash
npm run trellis -- discovery seed "clay workflow"
npm run trellis -- discovery run "https://www.linkedin.com/feed/update/urn:li:activity:123/"
npm run trellis -- discovery tick --source linkedin_public_post
```

These commands update `ai-sdr.config.ts` and `.env`.

### Add MCPs And Skills

To extend the operator or agent surface:

- mount another provider MCP into the harness
- add skills that encode how the agent should use it

### Add A First-Class Package

When an integration should become part of the framework:

- add or use a dedicated `@ai-sdr/<provider>` package
- map it into capability bindings
- document its environment variables, smoke checks, and contracts

## Deploy It

The minimum deployment stack is:

- Convex
- Vercel Sandbox
- Vercel AI Gateway
- Firecrawl
- Rivet
- normalized webhook ingest
- first-party MCP

Optional deployment modules:

- Apify
- Parallel
- Prospeo
- Attio
- AgentMail
- Slack

For a production deployment, keep `APP_URL` set explicitly, verify webhook routes against the deployed hostname, and leave `NO_SENDS_MODE=true` until workflow behavior has been reviewed end to end.
