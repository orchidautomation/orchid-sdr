# Net-New User Journey

## Purpose

This document describes the current and near-term day-zero experience for a brand new user who discovers Trellis from a Brandon LinkedIn post, clicks through to GitHub, and wants to create their own composable AI SDR.

This is written from the perspective of:

- a CLI-first product
- a build-first technical user
- a repo-managed, composable agentic GTM system
- current repo truth as of 2026-04-26

It is deliberately explicit about what already exists, what the user actually sees, what still has to be done by hand, and where Cloud Code or another coding agent can help.

---

## The Core Promise

The user is not buying a black-box AI SDR.

They are getting:

1. a scaffolded Trellis app repo
2. a composable module system
3. a first-party operator dashboard
4. a first-party MCP server
5. repo-managed GTM logic
6. a path to add discovery, research, enrichment, outbound, CRM, handoff, and future agents

The shortest honest promise is:

> Run one command, get a working Trellis repo, boot it locally, then layer in the GTM capabilities you actually want.

---

## Recommended Public Entry Point

For a brand new user, the clean public entry should be:

```bash
npx create-ai-sdr@latest
```

That is easier to understand than asking a stranger to clone a repo and run workspace scripts manually.

### Current equivalent inside this repo

Today, the equivalent command is:

```bash
npm run ai-sdr -- init
```

The rest of this document describes the public `npx` experience we should aim for, while calling out the exact current behavior where it differs.

---

## What The User Sees On LinkedIn And GitHub

### LinkedIn

The user sees a Brandon post that frames Trellis as:

- composable agentic GTM
- AI SDR as infrastructure
- signals -> qualification -> research -> enrichment -> outreach -> handoff
- explicit workflow stages, not magic

### GitHub landing page

The repo page should immediately answer five questions:

1. What is Trellis?
2. What does the first command look like?
3. What does the user get after that command?
4. What vendors are optional vs required?
5. What is the first meaningful success state?

The first screen on GitHub should make it obvious that the first meaningful milestone is:

> Boot the operator surface locally, then run one real signal through the system.

---

## Point A To Z: Day-Zero User Flow

## 1. The user runs the create command

Recommended public command:

```bash
npx create-ai-sdr@latest
```

Current repo equivalent:

```bash
npm run ai-sdr -- init
```

### What should happen

The user enters an interactive CLI wizard.

### What currently happens

The current interactive init wizard starts from the `core` runtime and now gives the user an interactive optional-lane toggle flow.

It prints:

- `Trellis init wizard`
- the base runtime summary
- an interactive optional-lane checklist

The user can toggle:

1. discovery
2. deep research
3. enrichment
4. CRM
5. email
6. handoff

Then it prompts for:

1. target directory
2. project name

### Important current truth

The wizard intentionally does **not** force a profile-picker-first mental model.

Right now:

- interactive init defaults to the `core` profile
- optional lanes can be toggled interactively
- module additions still also work through flags or follow-up `add ... --apply` commands

---

## 2. The user chooses what kind of Trellis they want

### Current profiles

The scaffold system already supports three profiles:

1. `core`
   - smallest honest runtime
   - manual or webhook-based signals
   - dashboard
   - MCP
   - no live discovery by default

2. `starter`
   - core plus:
   - LinkedIn discovery
   - deep research
   - enrichment

3. `production`
   - current production-parity reference stack
   - discovery
   - research
   - enrichment
   - outbound
   - CRM
   - handoff

### Current non-interactive ways to choose that

```bash
npx create-ai-sdr@latest my-sdr --profile core
npx create-ai-sdr@latest my-sdr --profile starter
npx create-ai-sdr@latest my-sdr --profile production
```

Current repo equivalent:

```bash
npm run ai-sdr -- init ../trellis-starter --profile starter --name trellis-starter
```

### Current optional module flags

The user can add or remove major optional lanes at scaffold time:

```bash
--with-discovery
--with-deep-research
--with-enrichment
--with-crm
--with-email
--with-handoff
```

And the inverse:

```bash
--without-discovery
--without-deep-research
--without-enrichment
--without-crm
--without-email
--without-handoff
```

### Product takeaway

The composition model already exists.

The missing product piece is that the wizard does not yet present those choices interactively.

---

## 3. The user gets a new repo

After scaffold completes, Trellis generates a new project directory and copies a runnable reference app into it.

### What is generated

At a high level, the new repo contains:

- `package.json`
- `ai-sdr.config.ts`
- `.env.example`
- `README.md`
- `TRELLIS_SETUP.md`
- `src/`
- `docs/`
- `knowledge/`
- `skills/`
- `scripts/`
- `tests/`
- `packages/`

### What this means

The user does **not** get a toy prompt.

They get an actual app repo with:

- runtime code
- dashboard
- provider bindings
- MCP server
- knowledge files
- skills
- docs
- tests

---

## 4. The CLI tells the user the next steps

Current scaffold output ends with concrete next steps:

1. `cd <target-dir>`
2. `npm install`
3. `cp .env.example .env`
4. `npm run typecheck`
5. `npm test`
6. `npm run doctor`
7. `npm run dev`
8. open `TRELLIS_SETUP.md`

This is good and should stay.

---

## 5. The user decides between the two day-zero paths

This is the first big branch.

## Path A: I just want to see it boot

This is the fastest path for a new user who wants confidence before wiring vendors.

They should use local smoke mode.

Example:

```bash
export TRELLIS_LOCAL_SMOKE_MODE=true
export TRELLIS_SANDBOX_TOKEN=local-sandbox-token
export HANDOFF_WEBHOOK_SECRET=local-handoff-secret
export DASHBOARD_PASSWORD=dev
export DISCOVERY_LINKEDIN_ENABLED=false

npm run doctor
npm run dev
```

Then they open:

```text
http://localhost:3000/dashboard
```

And log in with:

```text
dev
```

### What they see

1. dashboard login screen
2. operator console
3. service / kill switch / send mode / automation state
4. pipeline tabs
5. action buttons

### What this proves

- the repo boots
- the runtime wiring is intact
- auth works
- the dashboard renders
- the local operator surface is real

### What this does not prove

- real discovery
- real provider calls
- real persistence
- full AI SDR workflow execution

This is the right first-run path for a brand new user who wants to feel the product before buying into the full stack.

---

## Path B: I want to see the actual system work

This is the first real AI SDR path.

At this point the user needs real infrastructure and provider accounts.

### Minimum real stack for the current happy path

For the `core` or `starter` experience to feel real, the user eventually needs:

1. `Convex`
   - canonical state
   - dashboard-backed data
   - workflow persistence

2. `Vercel` credentials
   - sandbox execution
   - AI Gateway model routing

3. `Firecrawl`
   - default web search and extraction

4. `Apify`
   - if discovery is enabled

5. `Prospeo`
   - if enrichment is enabled

### Important nuance: Rivet

For **local development**, the app can use a local embedded Rivet runtime. A net-new user does **not** need a Rivet account just to boot locally.

For **deployed Vercel-style runtime orchestration**, the user does need remote Rivet configuration such as:

- `RIVET_ENDPOINT`
- `RIVET_TOKEN`
- `RIVET_PROJECT`
- `RIVET_ENV`

### Current truth

This distinction is important:

- local boot: Rivet account not required
- deployed full runtime: Rivet integration required

---

## 6. What the user must do by hand

This is where honesty matters.

The CLI scaffold does **not** currently create or connect vendor accounts automatically.

The user still has to:

1. create a Convex deployment
2. obtain Vercel Sandbox / AI Gateway credentials
3. obtain Firecrawl credentials
4. obtain Apify credentials if using discovery
5. obtain Prospeo credentials if using enrichment
6. optionally connect Attio / AgentMail / Slack
7. copy secrets into `.env`

### What `npm run doctor` does

`doctor` is the readiness verifier.

It tells the user:

- what is missing for boot
- what is missing for discovery
- what is missing for exact-post discovery
- what is missing for LinkedIn profile/company research
- what is optional

### What `doctor` does not do

It does not provision accounts or secrets.

---

## 7. Separation Of Concerns

This is the most important conceptual model for a new user.

## The wizard

The wizard is for:

- creating the repo
- picking the initial composition shape
- generating starter files

## `ai-sdr.config.ts`

`ai-sdr.config.ts` is the product composition file.

It decides:

- modules
- providers
- capability bindings
- campaigns
- webhooks
- model routing
- package boundaries
- knowledge file paths
- skill file paths

If the user asks, “Where do I decide what Trellis is made of?” the answer is:

> `ai-sdr.config.ts`

## `.env`

`.env` is for deployment- and account-specific values:

- URLs
- tokens
- API keys
- secrets
- runtime toggles

If the user asks, “Where do I put credentials?” the answer is:

> `.env`

## CLI commands

CLI commands are for:

- scaffolding
- module composition changes
- composition validation
- discovery seeding
- discovery runs
- discovery ticks

If the user asks, “How do I tell Trellis to do something operationally?” the answer is:

> use the CLI, dashboard, or MCP depending on the action

## Dashboard

The dashboard is for:

- operator visibility
- runtime flags
- lightweight manual actions
- state inspection

## MCP

The MCP endpoint is for:

- coding-agent control
- runtime inspection
- prospect/research/tool access
- safe remote operator actions

---

## 8. What Options The User Has Today

## During scaffold

The user can choose:

- profile
- target directory
- project name
- include/exclude module flags

## After scaffold

The user can layer more capabilities in with:

```bash
npm run ai-sdr -- add source apify --apply
npm run ai-sdr -- add deep-research parallel --apply
npm run ai-sdr -- add enrichment prospeo --apply
npm run ai-sdr -- add crm attio --apply
npm run ai-sdr -- add email agentmail --apply
npm run ai-sdr -- add handoff slack --apply
```

### What this does

`add ... --apply` updates:

- `ai-sdr.config.ts`
- `.env.example`
- `TRELLIS_SETUP.md`
- `README.md`

That is the current post-scaffold composition workflow.

---

## 9. Discovery, Cron, And Scheduling

The user asked whether the wizard lets them “add discovery” or “edit cron jobs.”

### Current truth

#### Add discovery

Yes, but not as a dedicated wizard screen.

The user adds discovery by:

- picking `starter` or `production`
- or adding the `apify-linkedin` module later

#### Edit cron jobs

Not via a cron editor UI today.

Scheduling is currently controlled by config and runtime settings such as:

- `DISCOVERY_INTERVAL_MS`
- `DISCOVERY_WEEKDAYS_ONLY`
- campaign/source wiring in `ai-sdr.config.ts`
- runtime actor state

The operational commands are:

```bash
npm run ai-sdr -- discovery seed "<term>"
npm run ai-sdr -- discovery run "<term>"
npm run ai-sdr -- discovery tick
```

### Important product distinction

This is not a general cron-builder product yet.

It is a composable GTM runtime with scheduled discovery behavior.

If we later expose cron editing in product, it should still compile down to repo config plus runtime state, not invent a second control plane.

---

## 10. What Screens The User Sees

## CLI screens

### Screen 1: init wizard

Current interactive prompts:

1. target directory
2. project name

Future desirable prompts:

1. profile picker
2. optional module checklist
3. local-only vs full-stack setup path
4. deploy target choice

## Browser screens

### Screen 2: dashboard login

At `/dashboard`, the user sees:

- Trellis login card
- dashboard password field

### Screen 3: operator console

After login, the user sees:

- service state
- send mode
- kill switch
- automation state
- views such as overview, pipeline, signals, runtime

### What the brand new user should eventually see next

The real first-run screen should eventually include a guided path such as:

1. connect providers
2. set ICP
3. paste one signal
4. run one workflow

That does not fully exist yet as a productized onboarding flow.

---

## 11. How MCP Fits Into The Experience

Every deployment exposes a first-party MCP endpoint.

### Local MCP

```text
http://localhost:3000/mcp/trellis
```

### Deployed MCP

```text
${APP_URL}/mcp/trellis
```

### Auth

- preferred token: `TRELLIS_MCP_TOKEN`
- fallback token: `TRELLIS_SANDBOX_TOKEN`

### Example MCP client config

```json
{
  "mcpServers": {
    "trellis": {
      "transport": {
        "type": "http",
        "url": "http://localhost:3000/mcp/trellis",
        "headers": {
          "Authorization": "Bearer dev-mcp-token"
        }
      }
    }
  }
}
```

### What the user does with MCP

Once the app is up, a coding agent can connect to MCP and:

- inspect runtime flags
- inspect discovery health
- inspect provider runs
- inspect prospects and threads
- trigger safe actions
- drive Trellis without clicking around the dashboard

This is how Trellis becomes part of a broader composable agentic GTM stack rather than just a dashboard app.

---

## 12. Deployment Path

This is another place where current truth matters.

### What the scaffold does not do today

There is no first-class deploy wizard yet.

The scaffold does **not** currently:

- provision Vercel
- provision Convex
- provision Rivet
- provision Apify
- provision Firecrawl
- write provider secrets into hosted environments

### What the user does today

The user chooses a deployment path after local validation.

#### Option A: stay local for build-first iteration

Use:

- local app server
- local dashboard
- local MCP endpoint
- smoke mode or full local envs

This is the correct early path for most technical users.

#### Option B: deploy the app

Current realistic deploy choices are:

1. Vercel-style deployment
2. self-hosted Node deployment

### If the user deploys on Vercel

They need to understand:

1. `APP_URL` becomes the public base URL
2. webhooks point to `${APP_URL}/webhooks/...`
3. MCP lives at `${APP_URL}/mcp/trellis`
4. if using remote Rivet orchestration on Vercel, `RIVET_ENDPOINT` is required
5. if `APP_URL` is unset, the app can fall back to `https://$VERCEL_URL`, but explicit `APP_URL` is better

### If the user self-hosts

They need:

1. a public HTTPS URL
2. environment variable management
3. access to provider APIs from the host
4. webhook reachability from Apify / AgentMail / other sources

### What the user sees after deploy

Once deployed, the same two surfaces matter:

1. dashboard
   - `${APP_URL}/dashboard`
2. MCP
   - `${APP_URL}/mcp/trellis`

That means local and deployed mental models stay aligned, which is good product design.

---

## 13. How Cloud Code Can Help

Cloud Code, Codex, Claude Code, or another coding agent can help a lot.

### A coding agent can help with

1. scaffolding the repo
2. explaining profile choices
3. editing `ai-sdr.config.ts`
4. applying modules with `add ... --apply`
5. filling `.env.example` placeholders
6. running `doctor`
7. booting the app locally
8. configuring MCP clients
9. seeding discovery terms
10. testing one known LinkedIn post URL
11. writing ICP / knowledge files
12. reviewing provider gaps
13. helping deploy once credentials are available

### A coding agent cannot fully replace

1. creating third-party accounts
2. logging into vendor dashboards
3. generating secrets out of thin air
4. making product or go-to-market decisions the repo does not already encode

### Best use of Cloud Code

The best use is:

> Let the coding agent drive the repo, config, and runtime surface after the human supplies product intent and vendor credentials.

---

## 14. The First Real “Wow” Moment

The first compelling end-to-end moment is not “the dashboard opened.”

It is:

> I pasted a LinkedIn post URL and Trellis turned it into a structured GTM action.

That means:

1. Trellis ingests the post as a signal
2. resolves the author
3. derives the author's current employer
4. treats that employer as the account target
5. qualifies the lead
6. builds research context
7. enriches contact info
8. drafts outreach
9. prepares CRM or human handoff

That is the first moment where the product clearly becomes composable agentic GTM instead of “just another dashboard.”

---

## 15. What The User Should Have By The End

By the end of day zero or day one, the user should have:

1. a Trellis repo
2. a known composition profile
3. a local operator dashboard
4. a first-party MCP endpoint
5. repo-managed ICP / product knowledge files
6. a path to add discovery, research, enrichment, outbound, CRM, and handoff
7. a clear next step toward running one real signal through the stack

For a more advanced user, they should also understand that Trellis can become the substrate for:

- multiple campaigns
- wake/sleep actor workflows
- asynchronous research and follow-up
- additional GTM agents that coordinate through MCP and shared state

---

## 16. What Is Missing Before Public Launch Feels Clean

These are the main gaps between the current repo and the ideal day-zero product experience.

1. The public `npx create-ai-sdr` package is not shipped yet.
2. There is no first-run “paste a signal and watch it work” onboarding inside the dashboard.
3. Cron/schedule editing is config-driven, not productized.
4. The new `deploy`, `connect`, and `mcp` commands are guidance surfaces, not full account-provisioning automation.
5. The public `create-ai-sdr` package still needs its own release and packaging path.

None of these block technical users, but they do define what “launch polish” means.

---

## 17. Recommended Day-Zero Narrative

If a stranger finds Trellis from LinkedIn, the intended story should be:

1. They understand what Trellis is.
2. They run one `npx` command.
3. They get a real app repo.
4. They can boot it locally without wiring the whole world.
5. They can connect real providers when ready.
6. They can control it through a dashboard and MCP.
7. They can turn one signal into structured GTM work.
8. They can keep composing from there.

That is the correct user journey for a CLI-first composable agentic GTM product.
