# Trellis New User Guide

This document is for someone who is brand new to this repo and wants to understand:

- what Trellis is
- what this reference app actually does
- why there are multiple scaffold profiles
- what accounts and credentials are really required
- what to expect on first boot
- how to extend the system later

If you only read one file before trying the repo, read this one.

## What Trellis Is

Trellis is a **Composable Agentic GTM** framework.

This repo currently contains two things at once:

1. the **reference AI SDR application**
2. the early **framework/packages** that will let someone scaffold their own agentic GTM system

So when you open this repo, you are not looking at a single-purpose app anymore. You are looking at:

- a working AI SDR control plane
- plus the first version of the Trellis framework that can scaffold similar systems

## What The Reference App Does

At a high level, the reference app does this:

1. ingests signals
2. researches the person, company, and source context
3. qualifies the lead
4. stores workflow state
5. exposes everything in a dashboard and MCP surface
6. optionally syncs CRM, drafts/sends email, and routes handoff

In practical terms, that means:

- it can accept **normalized inbound signals** from a webhook
- it can optionally run **scheduled discovery** from public sources like LinkedIn
- it can run **web research** against a person/company
- it can keep **state** in Convex
- it can orchestrate workflows with Rivet
- it can expose pipeline and controls through:
  - the dashboard
  - the first-party MCP server
- it can optionally:
  - enrich contacts
  - sync to Attio
  - send/reply through AgentMail
  - hand off to Slack

## Why The Profiles Exist

The profiles are **not product tiers** and **not different brands of Trellis**.

They are just **onboarding presets**.

They exist because the full system has a lot of external providers, and a brand new user does not need all of them on day one.

The profile split is there to answer:

- what is the smallest honest runtime?
- what is the best first experience?
- what is the full current production-parity stack?

That is all.

If you do not like the preset framing, ignore it operationally:

- `init` scaffolds `core`
- then you add what you need
- `starter` and `production` remain shortcut bundles, not the required mental model

### `core`

`core` is the smallest honest Trellis runtime.

It includes:

- normalized signal ingest
- Firecrawl for web search/extract
- Convex for state
- Rivet for orchestration
- Vercel Sandbox for agent execution
- Vercel AI Gateway for model routing
- the first-party MCP server

It does **not** include by default:

- live discovery
- deep research / monitor
- enrichment
- CRM sync
- outbound email
- Slack handoff

Use `core` when you want to prove:

- the app boots
- the dashboard works
- MCP works
- Convex/Rivet/Vercel/Firecrawl are wired correctly
- manual signals can move through the system

### `starter`

`starter` is the recommended first “this feels real” profile.

It includes everything in `core`, plus:

- Apify discovery
- Parallel deep research / monitor
- Prospeo enrichment

It still leaves out:

- CRM sync
- outbound email
- Slack handoff

Use `starter` when you want to see actual AI SDR value without immediately taking on outbound/CRM complexity.

### Model Routing

The reference app can route different LLMs to different jobs from `ai-sdr.config.ts`.

- `modelRouting.defaultModel` sets the global fallback
- `modelRouting.sandbox.defaultModel` sets the default model for sandbox-run agent turns
- `modelRouting.sandbox.stages` can override models for:
  - `discovery`
  - `qualify`
  - `build_research_brief`
  - `first_outbound`
  - `await_reply`
  - `classify_reply`
  - `respond_or_handoff`
- `modelRouting.structured` can override:
  - `classifyReply`
  - `policyCheck`
  - `qualifyProspect`

That lets you keep one cheaper model for drafting or monitoring and a stronger model for qualification or research if you want to.

This is the best profile for most first-time technical users.

### `production`

`production` is the full current Orchid SDR parity stack.

It includes everything in `starter`, plus:

- Attio CRM sync
- AgentMail outbound + reply handling
- Slack handoff

Use `production` when you want the reference app behaving like the current full AI SDR deployment.

This is the heaviest profile and has the most external accounts.

## What I Should Do As A New User

If you are brand new, the simplest framing is:

- if you want to **prove the platform works**, start with `core`
- if you want to **feel the SDR value quickly**, start with `core` and then add discovery/research/enrichment
- if you want **full parity with the current app**, use `production`

My recommendation for a first-time technical evaluator is:

1. scaffold `core`
2. keep `NO_SENDS_MODE=true`
3. get the dashboard healthy
4. add discovery, deep research, and enrichment
5. run probe / discovery
6. inspect the pipeline and MCP surface
7. only after that, add CRM and email

If you are using Codex or another skill-aware coding agent, the repo now also includes setup skills for:

- `skills/setup-and-verify`
- `skills/convex-setup`
- `skills/vercel-setup`

## What You Need To Bring

### Always Needed For A Good Experience

These are the real core dependencies for the current Trellis happy path.

#### 1. Convex

Role:

- Trellis operational state plane
- system of record for the reference app
- dashboard and workflow state backing store

You will typically need:

- `CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- optionally `CONVEX_DEPLOYMENT`
- optionally `CONVEX_DEPLOY_KEY`

Important:

- Convex is now the default state backend
- Neon/Postgres is **not** required for the default path anymore

#### 2. Vercel

Role:

- Sandbox execution
- AI Gateway model routing
- optional hosted deployment target

You will typically need one of these auth paths for Sandbox:

- `VERCEL_OIDC_TOKEN`
- or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`

For model routing:

- `AI_GATEWAY_API_KEY`
- or `VERCEL_AI_GATEWAY_KEY`

Important:

- Vercel is infrastructure here, not the app login provider
- the app does **not** currently use Vercel OAuth for end-user auth

#### 3. Firecrawl

Role:

- primary search
- primary extraction

You will need:

- `FIRECRAWL_API_KEY`

#### 4. Rivet

Role:

- actor orchestration
- workflow scheduling
- runtime control plane

You will typically need some combination of:

- `RIVET_ENDPOINT`
- `RIVET_TOKEN`
- `RIVET_PROJECT`
- `RIVET_ENV`
- possibly `RIVET_PUBLIC_ENDPOINT`
- possibly `RIVET_PUBLIC_TOKEN`

If you are using the Vercel-connected Rivet flow, those values usually come from Rivet’s dashboard/provider connect flow.

#### 5. Core Secrets

You will also need:

- `APP_URL`
- `ORCHID_SDR_SANDBOX_TOKEN`
- `HANDOFF_WEBHOOK_SECRET`

Recommended:

- `ORCHID_SDR_MCP_TOKEN`
- `DASHBOARD_PASSWORD`

### Additional Accounts By Profile

#### `starter` adds

- `Apify`
  - scheduled discovery from LinkedIn public posts
  - `APIFY_TOKEN`
  - `APIFY_LINKEDIN_TASK_ID` or `APIFY_LINKEDIN_ACTOR_ID`
  - `APIFY_WEBHOOK_SECRET`
  - optional richer LinkedIn profile/company research:
    - `APIFY_LINKEDIN_PROFILE_TASK_ID` or `APIFY_LINKEDIN_PROFILE_ACTOR_ID`
  - note: scraping recent posts from a specific LinkedIn profile is an optional future lane, not part of the current AI SDR happy path

- `Parallel`
  - deep research
  - monitoring
  - `PARALLEL_API_KEY`

- `Prospeo`
  - contact enrichment
  - `PROSPEO_API_KEY`

#### `production` adds

- `Attio`
  - CRM sync
  - `ATTIO_API_KEY`

- `AgentMail`
  - outbound email and reply handling
  - `AGENTMAIL_API_KEY`
  - `AGENTMAIL_WEBHOOK_SECRET`

- `Slack`
  - handoff
  - `SLACK_BOT_TOKEN` and/or `SLACK_WEBHOOK_URL`

## What To Expect On First Boot

If you scaffold and configure things correctly, here is what should happen.

### 1. The app boots locally

You should be able to run:

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run doctor
npm run dev
```

Then open:

```text
http://localhost:3000/dashboard
```

### 2. The dashboard should resolve

You should expect:

- the dashboard shell loads
- service/send-mode/automation flags resolve
- `/healthz` returns `200`
- dashboard data may take a couple seconds to fill on first load

### 3. Auth is simple right now

Dashboard auth:

- route: `/dashboard`
- password source: `DASHBOARD_PASSWORD`
- fallback: `ORCHID_SDR_SANDBOX_TOKEN`

MCP auth:

- route: `/mcp/orchid-sdr`
- bearer token: `ORCHID_SDR_MCP_TOKEN`
- fallback: `ORCHID_SDR_SANDBOX_TOKEN`

There is no first-party OAuth login flow yet.

### 4. URLs are derived from `APP_URL`

Local:

- dashboard: `http://localhost:3000/dashboard`
- MCP: `http://localhost:3000/mcp/orchid-sdr`

Deployed:

- dashboard: `${APP_URL}/dashboard`
- MCP: `${APP_URL}/mcp/orchid-sdr`
- webhooks: `${APP_URL}/webhooks/...`

Important:

- `APP_URL` is the source of truth for deployed callback URLs
- on Vercel, if `APP_URL` is unset, the app falls back to `https://$VERCEL_URL`
- for a real deployment, set `APP_URL` explicitly

## How To Get Immediate Value

If your goal is “show me why this is useful,” do this:

### Option A: Platform proof

Use `core`.

What you prove:

- state works
- orchestration works
- research works
- MCP works
- dashboard works

What you will not yet see:

- automatic discovery
- enrichment
- CRM sync
- outbound sending

### Option B: Best first SDR experience

Use `starter`.

What you prove:

- live discovery works
- deep research works
- enrichment works
- the pipeline starts to feel like a real AI SDR

What you still avoid:

- outbound risk
- CRM mutation complexity

This is the best first-time experience for most people.

### Option C: Full current AI SDR

Use `production`.

What you prove:

- the full current Orchid SDR behavior
- CRM sync
- outbound email
- reply handling
- handoff

Keep this safe on first boot:

- set `NO_SENDS_MODE=true`
- do not enable real outbound until you have reviewed the pipeline, research, and CRM behavior

## Recommended First-Time Path

If I were onboarding a new technical evaluator to Trellis, I would tell them to do this:

1. scaffold `core`
2. connect Convex, Vercel, Firecrawl, and Rivet
3. keep `NO_SENDS_MODE=true`
4. run `npm run doctor`
5. open the dashboard
6. verify the dashboard and MCP surface are healthy
7. add discovery, deep research, and enrichment with:
   - `npm run ai-sdr -- add source apify --apply`
   - `npm run ai-sdr -- add deep-research parallel --apply`
   - `npm run ai-sdr -- add enrichment prospeo --apply`
8. fill the newly added env vars
9. run another `npm run doctor`
10. run a sandbox probe
11. run a discovery tick
12. inspect leads in the pipeline
13. only then add Attio and AgentMail

That path gets you to the real value quickly without taking on the highest-risk integrations first.

## How To Extend It Yourself

There are three main extension surfaces.

### 1. Add Optional Providers

You can extend the stack by CLI first:

```bash
npm run ai-sdr -- add source apify --apply
npm run ai-sdr -- add deep-research parallel --apply
npm run ai-sdr -- add enrichment prospeo --apply
```

Under the hood this updates:

- `ai-sdr.config.ts`
- `.env`

Examples:

- add Attio for CRM sync
- add AgentMail for email
- add Slack for handoff

The idea is:

- `core` gives you the minimum honest runtime
- additional providers are layered on intentionally

### 2. Add MCPs And Skills

If you want to move fast:

- mount another provider MCP into the harness
- add skills that teach the agent how to use it

This is the fastest path for experimentation.

### 3. Add A First-Class Package

If the integration should become part of the framework:

- add or use a real `@ai-sdr/<provider>` package
- map it into capability bindings
- document its env, smoke checks, and contracts

That is the durable path.

## What Is Optional vs Core

Core today:

- Convex
- Vercel Sandbox
- Vercel AI Gateway
- Firecrawl
- Rivet
- normalized webhook ingest
- first-party MCP

Optional:

- Apify
- Parallel
- Prospeo
- Attio
- AgentMail
- Slack
- Neon

Important:

- Neon is now optional
- MotherDuck is a future happy-path warehouse, not a current requirement

## What This Repo Is Not Yet

This is already a real working reference system, but it is still evolving.

It is **not yet**:

- a fully polished public `npx` install experience
- a hosted SaaS onboarding flow
- a Vercel-OAuth-based multi-user product
- a finished package-published framework ecosystem

It **is**:

- a working reference AI SDR
- a working Trellis scaffold flow
- a local workspace package-based framework
- a serious base for composable agentic GTM

## If You Want The Simplest Summary

If you are brand new:

- start with `core`
- then add:
  - `source apify`
  - `deep-research parallel`
  - `enrichment prospeo`
- bring:
  - Convex
  - Vercel
  - Firecrawl
  - Rivet
  - Apify
  - Parallel
  - Prospeo
- keep `NO_SENDS_MODE=true`
- expect:
  - dashboard
  - MCP
  - discovery
  - research
  - enrichment
  - pipeline state
- do **not** start with CRM and outbound email unless you already trust the stack

That is the cleanest path to immediate value.
