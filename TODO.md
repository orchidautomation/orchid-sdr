# TODO

This file is the working state document for the product currently living in this repo.

Current framing:

- **Product:** `Trellis`
- **Company / studio:** Orchid Labs
- **Category:** Composable Agentic GTM
- **Current reference app:** Orchid SDR

This is no longer just an outbound checklist. It is the current map of:

- what exists today
- what is partially done
- what still blocks the framework/product from feeling complete

## Current Truth

What is true right now:

- the repo runs as a **single application package** named `orchid-sdr`
- the repo is now also an **npm workspace** with extracted local packages under `packages/`
- the framework now has **typed capability bindings**, **module definitions**, **package boundaries**, and **composition profiles**
- the default research taxonomy is now explicitly:
  - `research.search.v1`
  - `research.extract.v1`
  - `research.deepResearch.v1`
  - `research.monitor.v1`
  - `research.enrich.v1`
- the default provider split is now:
  - `search -> firecrawl`
  - `extract -> firecrawl`
  - `deep research -> parallel`
  - `monitor -> parallel`
  - `enrichment -> prospeo`
- the app is deployed and working with:
  - Vercel
  - Rivet
  - Convex
- Convex now backs the full operational repository path for the default reference app
- Neon/Postgres is now an optional compatibility module, not part of the default boot path
- the operator dashboard, pause controls, Rivet integration, and framework config-driven provider selection are live

What is **not** true yet:

- this is **not yet** a published multi-package npm distribution
- the extracted `@ai-sdr/*` packages are real local workspace packages, but they are **not published to npm** yet
- `npm run ai-sdr -- init` now generates a **workspace-backed scaffold**
- a published `npx ai-sdr init` experience still does **not** exist yet
- the reference app still depends on some implicit app glue rather than being fully generated from config
- the state-plane contract still has some compatibility-era duplication semantics that should be simplified now that the repository is also Convex-backed

## How To Run It Today

This is how it works **right now**, before the packaging/wizard work is finished:

1. install dependencies

```bash
npm install
```

2. configure env

```bash
cp .env.example .env
```

3. validate the repo

```bash
npm run typecheck
npm test
npm run doctor
```

4. build and run

```bash
npm run build
npm run dev
```

5. use the current local framework CLI prototype

```bash
npm run ai-sdr -- modules
npm run ai-sdr -- check
npm run ai-sdr -- add search firecrawl
npm run ai-sdr -- add extract firecrawl
npm run ai-sdr -- add deep-research parallel
npm run ai-sdr -- add monitor parallel
npm run ai-sdr -- add enrichment prospeo
```

Important:

- this current `ai-sdr` CLI is now a **workspace-backed local install surface**
- it can scaffold a working reference app template that includes local `@ai-sdr/*` packages
- it is still not the polished published `npx` onboarding experience

## What Has Been Done

### Framework / Composition

- [x] introduce typed framework config in `ai-sdr.config.ts`
- [x] define module metadata for the current providers
- [x] define provider metadata from modules
- [x] add capability bindings
- [x] add package boundary metadata for future `@ai-sdr/*` extraction
- [x] add composition profiles:
  - `minimum`
  - `productionParity`
- [x] validate config references and unsupported bindings
- [x] expose a prototype `npm run ai-sdr` CLI
- [x] add a first-pass `npm run ai-sdr -- init` scaffold flow with:
  - `core`
  - `starter`
  - `production` profiles

### Taxonomy / Provider Mapping

- [x] formalize research contracts:
  - `research.search.v1`
  - `research.extract.v1`
  - `research.deepResearch.v1`
  - `research.monitor.v1`
  - `research.enrich.v1`
- [x] keep CLI labels simple:
  - `search`
  - `extract`
  - `deep-research`
  - `monitor`
  - `enrichment`
- [x] bind Firecrawl to search/extract by default
- [x] bind Parallel to deep research/monitor by default
- [x] bind Prospeo to enrichment by default

### Runtime / Deployment

- [x] Vercel production deployment
- [x] Rivet connected to Vercel deployment
- [x] Convex production deployment created and wired
- [x] dashboard split into faster core data and slower runtime data
- [x] pause automation control
- [x] pause semantics changed to:
  - allow in-flight work to finish
  - prevent new automation from starting

### Vision / Product Direction

- [x] tracked GTM vision docs created and maintained in `gtm/`
- [x] broader GTM preset ideas documented
- [x] linked intelligence / attribution / meeting prep / CS use cases documented
- [x] naming direction updated:
  - product: `Trellis`
  - category: `Composable Agentic GTM`

### Onboarding

- [x] generated `TRELLIS_SETUP.md` per scaffolded project
- [x] added a first-pass getting-started guide in `docs/getting-started.md`
- [x] added a tracked `skills/setup-and-verify` skill for first-boot agent guidance
- [x] make `init` generate workspace-backed package dependencies and copy local `packages/`
- [x] make `init` work as an interactive local wizard when you omit the target directory

## What Still Needs To Be Done

## P0: Turn It Into A Real Framework Product

- [x] extract the first package boundaries into a real workspace/package structure
  - current local packages:
    - `@ai-sdr/framework`
    - `@ai-sdr/convex`
    - `@ai-sdr/firecrawl`
    - `@ai-sdr/parallel`
    - `@ai-sdr/rivet`
    - `@ai-sdr/vercel-sandbox`
    - `@ai-sdr/vercel-ai-gateway`
    - `@ai-sdr/webhooks`
    - `@ai-sdr/apify-linkedin`
    - `@ai-sdr/prospeo`
    - `@ai-sdr/attio`
    - `@ai-sdr/agentmail`
    - `@ai-sdr/slack`
    - `@ai-sdr/mcp`
    - `@ai-sdr/neon`
    - `@ai-sdr/cli`
- [x] decide on the workspace/package manager shape
  - current answer: **npm workspaces**
- [x] make the reference app consume the extracted framework package through compatibility shims
- [ ] decide package build/publish strategy for public npm distribution
- [ ] define the minimal public package surface for each extracted package
- [ ] replace the remaining compatibility shims with direct package imports where it improves clarity
- [ ] decide whether `@ai-sdr/neon` should ship as a real optional package or stay internal until needed

## P0: Build The Real Onboarding Flow

- [ ] publish the scaffold flow as a real `npx ai-sdr init` experience
- [x] generate a new project from a template instead of expecting repo surgery
- [x] support at least three profiles:
  - `core`
  - `starter`
  - `production`
- [x] support current local profiles:
  - `core`
  - `starter`
  - `production`
- [x] keep `demo` as a backward-compatible alias to `core` while removing it from the public UX
- [ ] add a stricter zero-vendor mock profile if we want a pure no-accounts demo later
- [ ] wizard should collect:
  - project/preset name
  - runtime choice
  - state/database choice
- [x] wizard now collects optional module choices for:
  - discovery
  - deep research
  - enrichment
  - CRM
  - email
  - handoff
- [ ] wizard should generate:
  - config file
  - `.env.example`
  - install checklist
  - deploy checklist
  - optional skills/knowledge scaffolding
- [x] make `init` interactive instead of flag-only
- [ ] split `init` into product presets as the framework grows beyond AI SDR

## P0: Finish The State Plane Migration

- [x] move prospects into Convex-backed state plane boundaries
- [x] move threads into Convex-backed state plane boundaries
- [x] move messages into Convex-backed state plane boundaries
- [x] move provider runs into Convex-backed state plane boundaries
- [x] move dashboard reads off the old repository path where appropriate
- [x] remove the current hard dependency on `DATABASE_URL` for the default runtime architecture
- [ ] decide how much of the legacy SQL repository path should remain in-tree as an optional compatibility module

Important current truth:

- Convex is now part of the runtime architecture
- Convex is now the default operational source of truth for the reference app
- Neon/Postgres remains available only for optional SQL compatibility work

## P0: Finish Provider Normalization

- [ ] formalize contracts for:
  - CRM
  - email
  - handoff
  - source
  - state
  - runtime
- [ ] define which provider capabilities are:
  - default
  - optional
  - experimental
- [ ] add stronger provider-specific smoke checks
- [ ] model MCP-first providers cleanly:
  - fast path = MCP + skills
  - productized path = package + config binding

## P0: Make The Reference App Truly Config-Driven

- [ ] reduce remaining implicit adapter wiring inside the reference app
- [ ] allow the app to instantiate its runtime shape entirely from config selections
- [ ] make missing capabilities fail clearly and early
- [ ] ensure removing a provider from config actually removes the behavior cleanly

Example target behavior:

- remove Attio -> no CRM sync
- remove Firecrawl -> no search/extract
- remove Parallel -> no deep research or monitor
- remove AgentMail -> no outbound email lane

## P1: Productization / Docs / Installability

- [ ] update README to describe `Trellis` framing without breaking the current Orchid SDR reference app explanation
- [ ] document the package taxonomy clearly
- [ ] document the preset model clearly
- [ ] create a first-class setup guide for:
  - local development
  - self-hosted customer deployment
  - Vercel + Rivet + Convex default deployment
- [ ] add automated secret/env validation for the wizard path
- [ ] add generated examples for:
  - `ai-sdr`
  - `inbound-router`
  - `meeting-prep`
  - `signal-ops`

## P1: Deploy / Provisioning UX

- [ ] make it easier to wire:
  - Vercel
  - Rivet
  - Convex
  - Neon
  - Firecrawl
  - Parallel
  - Attio
  - AgentMail
- [ ] decide how much provisioning the wizard should automate vs document
- [ ] add one happy-path “best stack” deploy flow for the default opinionated setup

## P1: Operational Confidence Still Needed

- [ ] run a full discovery -> qualification -> research -> database/state append loop on a fresh signal source and verify all artifacts
- [ ] test generic `/webhooks/signals` with at least one non-Apify source payload
- [ ] validate Apify failure and retry paths
- [ ] add a separate Apify "profile posts scraper" lane as an optional post-discovery research step without making it part of the default AI SDR flow
- [ ] re-score or refresh older prospects after major qualification logic changes
- [ ] test real reply classifications beyond the positive path:
  - objection
  - referral
  - unsubscribe
  - wrong person

## P2: Operator / Observability Hardening

- [ ] persist richer sandbox logs
- [ ] improve blocked-send diagnostics in dashboard + MCP
- [ ] add a manual `research.rebuild` or `lead.refreshResearch` control
- [ ] add a dedicated preview/test mode for outbound generation
- [ ] add stronger throughput / cost / conversion scorecards
- [ ] add one prospect detail page with:
  - qualification reasoning
  - research brief
  - copy guidance
  - send / reply history
  - CRM sync state

## P2: Future Capability Expansion

- [ ] add more first-class capability families over time:
  - `browser`
  - `retrieval`
  - `knowledge_sync`
  - `private_context`
  - possibly `identity`
  - possibly `analytics`
- [ ] evaluate future provider packages for:
  - Exa
  - Steel
  - Airweave
  - Salesforce
  - HubSpot
  - Twenty
  - Nango-backed CRM adapters

## Decisions Already Made

- [x] internal contracts stay precise
- [x] public CLI/wizard labels stay simple
- [x] Firecrawl is the default search/extract provider
- [x] Parallel is the default deep-research/monitor provider
- [x] Prospeo is the default enrichment provider
- [x] GTM vision docs moved into tracked `gtm/`
- [x] `Trellis` is the product name direction
- [x] `useTrellis.dev` is good enough as the current domain

## Short Answer: Do We Still Need The CLI Wizard?

Yes.

Right now the system is powerful, but still too repo-native.

Without the wizard, a new user still has to understand:

- env setup
- provider selection
- capability bindings
- deployment choices
- knowledge pack editing
- runtime wiring

That is too much friction for the product shape you want.

`npx ai-sdr init` or a broader future `trellis` CLI is still one of the highest-value missing pieces.

## Short Answer: What Still Blocks "Packages And Stuff"?

The biggest blockers are:

1. real workspace/package extraction
2. real scaffold/init wizard
3. full Convex state-plane migration
4. fully config-driven reference app wiring
5. smoother provisioning/deploy UX

Until those are done, the framework exists conceptually and operationally, but not yet in the polished installable form you want.
