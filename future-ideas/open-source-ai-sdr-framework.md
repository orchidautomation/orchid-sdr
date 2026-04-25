# Open-Source AI SDR Framework Vision

## Status

Future direction. This is not the current production contract for Orchid SDR.

## North Star

Orchid SDR should evolve from one deployable AI SDR into the open-source framework for building custom AI SDRs.

The thesis:

> Every company has a different SDR motion, so the AI SDR should be programmable, self-hostable, and composable.

Most AI SDR tools sell a fixed agent behind a dashboard. That is useful for simple motions, but it breaks down when the company has custom source data, unusual ICP logic, multiple products, CRM-specific workflows, compliance constraints, agencies, partner motions, or founder-led outbound.

Orchid should become the framework those teams use when they want to roll their own AI SDR with their own sources, skills, tools, policies, and infrastructure.

The core builder persona is a GTM engineer, RevOps engineer, or technical founder using Codex, Claude Code, or another coding agent to generate and modify the SDR from stable primitives. The framework should give those coding agents typed contracts, schemas, tests, and docs so they can build useful customer-specific motion without turning the repo into a one-off tangle.

## Inspiration

Twenty is a useful comparison point.

Their developer surface is built around apps, APIs, self-hosting, and TypeScript packages. Their docs describe extending the CRM with custom objects, server-side logic, UI components, and AI agents. Their app scaffolder uses `npx create-twenty-app@latest`, then local commands such as `yarn twenty dev`, `yarn twenty add`, and `yarn twenty deploy`.

The lesson is not "copy Twenty's CRM." The lesson is:

- make the system self-hostable
- make the developer entrypoint obvious
- make extensions typed and packageable
- make local development fast
- make integration testing part of the framework
- make the product feel like infrastructure, not a closed app

Orchid can do the same for AI SDRs.

## Positioning

Possible category:

> The open-source AI SDR framework.

Possible headline:

> Build and self-host custom AI SDRs with composable sources, skills, tools, and CRM adapters.

Possible contrast:

> AI SDRs are black boxes. Orchid is the open-source control plane.

## Desired Developer Experience

Scaffold a new AI SDR:

```bash
npx create-ai-sdr@latest my-sdr
cd my-sdr
npm run dev
```

Add providers and capabilities:

```bash
npx ai-sdr add source hubspot
npx ai-sdr add crm attio
npx ai-sdr add email agentmail
npx ai-sdr add state convex
npx ai-sdr add source apify
npx ai-sdr add search parallel
npx ai-sdr add extract firecrawl
npx ai-sdr add enrichment parallel
npx ai-sdr add database neon
npx ai-sdr add skill product-routing
npx ai-sdr doctor
```

Deploy:

```bash
npx ai-sdr deploy
```

The exact CLI name can change, but the shape should stay simple:

- `create-ai-sdr` creates a complete deployable app
- `ai-sdr add <capability> <provider>` adds integrations, env vars, tools, docs, and tests
- `ai-sdr doctor` verifies database, env, MCP, webhooks, provider auth, and send safety
- `ai-sdr deploy` helps ship to the chosen target

The long-term config should be close to a YAML manifest. TypeScript can remain the typed implementation surface, but a GTM engineer should be able to understand the whole system from one declarative file:

```yaml
state:
  provider: convex
  package: "@ai-sdr/convex"

runtime:
  provider: rivet
  package: "@ai-sdr/rivet"

modules:
  - capability: search
    provider: parallel
    package: "@ai-sdr/parallel"
    mcp:
      - id: parallel-search
      - id: parallel-task
  - capability: extract
    provider: firecrawl
    package: "@ai-sdr/firecrawl"
    mcp:
      - id: firecrawl
```

Twenty is a useful inspiration here: keep the repo self-hostable, package the extension points, and make the app manifest obvious enough for agents and humans to edit.

The default stack should be opinionated:

```text
Convex = reactive source of truth
Rivet = live agent runtime
AI Gateway = model routing
MCP = tool surface
Skills = judgment layer
Provider packages = GTM integrations
```

## Package Naming Notes

As of April 25, 2026, these npm package names returned `404 Not Found` from the public npm registry:

- `aisdr`
- `aidsr`
- `create-ai-sdr`
- `ai-sdr`
- `@ai-sdr/core`
- `@aisdr/core`
- `@aidsr/core`
- `@orchid-sdr/core`

Best naming direction:

- use `create-ai-sdr` for scaffolding
- use `ai-sdr` as the CLI package and binary
- use `@ai-sdr/*` for framework packages if the npm organization can be claimed
- keep `orchid-sdr` as the reference implementation and original project identity

Example package family:

```text
create-ai-sdr
ai-sdr
@ai-sdr/core
@ai-sdr/sdk
@ai-sdr/cli
@ai-sdr/attio
@ai-sdr/hubspot
@ai-sdr/salesforce
@ai-sdr/twenty
@ai-sdr/agentmail
@ai-sdr/convex
@ai-sdr/parallel
@ai-sdr/apify
@ai-sdr/firecrawl
@ai-sdr/neon
@ai-sdr/vercel-sandbox
```

## Core Primitives

### Signals

Inputs that start or update a GTM workflow:

- HubSpot forms
- LinkedIn posts
- X/Twitter posts
- website visitors
- job posts
- funding events
- intent data
- Slack/manual submissions
- CSV uploads
- CRM stage changes

### Prospects

Normalized people and companies with:

- identity
- company context
- role/title
- social URLs
- email candidates
- source provenance
- research evidence
- CRM IDs

### Threads

Durable workflows for each prospect/account:

- captured
- researched
- qualified
- drafted
- sent
- awaiting reply
- replied
- paused
- handed off
- synced to CRM

### Skills

Versioned instructions and policies that teach the agent judgment:

- ICP qualification
- company diagnosis
- product routing
- research brief generation
- source validation
- copywriting
- reply classification
- compliance
- handoff policy
- CRM update policy

### Providers

Swappable integrations:

- CRM: Attio, HubSpot, Salesforce, Twenty
- email: AgentMail, Gmail, Outlook, custom SMTP/API
- state: Convex by default
- database: Neon Postgres, Supabase Postgres, RDS Postgres, self-hosted Postgres
- discovery: Apify, custom webhooks, job boards, RSS, Clay, first-party data
- search: Parallel, Firecrawl, search APIs, browser/sandbox tools
- extract: Parallel, Firecrawl, browser/sandbox tools
- enrichment: Parallel, Clay, Prospeo, custom data providers
- LLM: Vercel AI Gateway, OpenAI, Anthropic, local models, OpenRouter
- execution: local runtime, Vercel Sandbox, other cloud code harnesses

### MCP Tools

Typed operator and agent tools:

- inspect pipeline state
- inspect a lead
- trigger research
- qualify a lead
- preview outreach
- send or pause
- sync CRM
- route handoff
- manage campaigns

## Proposed SDK Shape

Example:

```ts
import { defineAiSdr } from "@ai-sdr/core";
import attio from "@ai-sdr/attio";
import agentmail from "@ai-sdr/agentmail";
import hubspot from "@ai-sdr/hubspot";
import apifyLinkedIn from "@ai-sdr/apify-linkedin";

export default defineAiSdr({
  product: "./knowledge/product.md",
  icp: "./knowledge/icp.md",
  compliance: "./knowledge/compliance.md",
  providers: [
    hubspot(),
    attio(),
    agentmail(),
    apifyLinkedIn(),
  ],
  campaigns: [
    {
      id: "default",
      timezone: "America/New_York",
      noSendsMode: true,
    },
  ],
});
```

Lower-level extension APIs:

```ts
defineSignalSource();
defineCrmAdapter();
defineEmailProvider();
defineResearchProvider();
defineSkill();
defineCampaign();
defineQualificationPolicy();
defineHandoffPolicy();
defineMcpTool();
```

## What `ai-sdr add crm attio` Should Do

Adding an adapter should be more than installing a dependency.

For example:

```bash
npx ai-sdr add crm attio
```

Should:

- install the Attio adapter package
- add env vars to `.env.example`
- register the adapter in `ai-sdr.config.ts`
- add or enable MCP tools such as `crm.syncProspect`
- add any required migrations
- add setup docs
- add a smoke test
- update `ai-sdr doctor` checks

The same pattern should apply to HubSpot, AgentMail, Twenty, Salesforce, Apify, Parallel, Firecrawl, Neon, and other providers.

## Current Orchid Assets

Orchid already has many of the hard pieces:

- deployable Node/Hono app
- Postgres system of record
- Rivet actor workflows
- first-party MCP server
- dashboard
- Apify discovery adapter
- generic normalized signal webhook
- research and qualification pipeline
- repo-managed skills
- knowledge pack
- AgentMail send/reply path
- Attio sync and stage promotion
- no-sends mode
- global kill switch
- campaign timezones and quiet hours
- Docker and Compose self-hosting path
- audit trail

This is enough to become the reference implementation.

## Gaps To Become A Framework

### 1. Extract Core Concepts

Separate framework primitives from this specific Orchid instance:

- core schemas
- repository contracts
- provider interfaces
- MCP tool registration
- skill loading
- campaign config
- normalized signal contract

### 2. Add Config-Driven Composition

Introduce a root config file:

```text
ai-sdr.config.ts
```

The app should load providers, skills, campaigns, and policies from config instead of hardcoding one deployment's choices.

### 3. Package The CLI

Build a CLI that can:

- scaffold a project
- add adapters
- add skills
- run local dev
- run migrations
- run smoke checks
- generate MCP config
- deploy or produce deployment artifacts

### 4. Create Adapter Boundaries

Turn current integrations into explicit adapters:

- `@ai-sdr/attio`
- `@ai-sdr/agentmail`
- `@ai-sdr/convex`
- `@ai-sdr/apify`
- `@ai-sdr/parallel`
- `@ai-sdr/firecrawl`
- `@ai-sdr/neon`
- `@ai-sdr/vercel-ai-gateway`
- `@ai-sdr/vercel-sandbox`
- `@ai-sdr/mcp`
- `@ai-sdr/slack`
- `@ai-sdr/hubspot`
- `@ai-sdr/twenty`

Each adapter should bring:

- config schema
- env docs
- runtime implementation
- MCP tools, if needed
- smoke tests

### 5. Build A First-Class HubSpot Source

The generic signal webhook is enough for pilots, but the framework should include a polished warm-lead path:

- HubSpot form webhook
- contact/company enrichment
- source mapping
- replayable payload logs
- tests with fixture payloads

### 6. Add Project Templates

Initial templates:

- outbound public-signal SDR
- warm inbound qualifier
- agency multi-client SDR
- founder-led outbound assistant
- product-routing SDR
- Twenty CRM app integration

### 7. Improve Evaluations

Framework trust needs repeatable evals:

- qualification fixtures
- copy quality fixtures
- compliance rejection fixtures
- reply classification fixtures
- provider failure fixtures
- end-to-end smoke tests

### 8. Make Docs Developer-First

Needed docs:

- why open-source AI SDR
- quickstart
- architecture
- config reference
- adapter authoring
- skill authoring
- provider authoring
- MCP tools
- self-hosting
- production checklist
- security model
- examples

## Suggested Milestones

### Milestone 1: Reference App

Goal: make current Orchid SDR easy to clone and deploy.

Already mostly done:

- Dockerfile
- Compose example
- self-hosting doc
- production checklist

Next:

- one-command smoke script
- clearer `.env.example` sections
- example normalized warm-lead payloads
- public demo seed data

### Milestone 2: Developer Shape

Goal: make the future framework visible without fully extracting everything.

Build:

- `ai-sdr.config.ts` (started)
- config loader (started)
- provider registry (started)
- skill registry
- adapter contracts
- `doctor` script inside this repo (started)

### Milestone 3: CLI Prototype

Goal: prove the command shape.

Build:

- local `ai-sdr` CLI package
- `ai-sdr doctor`
- `ai-sdr add crm attio`
- `ai-sdr add email agentmail`
- `ai-sdr add state convex`
- `ai-sdr add source hubspot`
- `ai-sdr add search parallel`
- `ai-sdr add extract firecrawl`
- `ai-sdr add enrichment parallel`
- `ai-sdr add database neon`
- `ai-sdr mcp-config`

This can start as internal scripts before publishing.

### Milestone 4: Monorepo Packages

Goal: split the framework from the reference app.

Create packages:

- `packages/core`
- `packages/cli`
- `packages/sdk`
- `packages/adapters/attio`
- `packages/adapters/agentmail`
- `packages/adapters/hubspot`
- `templates/default`

### Milestone 5: Public Launch

Goal: make it feel like a real open-source developer project.

Ship:

- package names reserved on npm
- clean GitHub README
- docs site
- quickstart video/gif
- public examples
- hosted demo or sandbox
- first integration guide for Twenty, Attio, and HubSpot

## Immediate Next Actions

1. Reserve the package names before someone else does.
2. Keep expanding the one-command `doctor` script into a true deployment verifier.
3. Continue evolving `ai-sdr.config.ts` from descriptive metadata into runtime composition.
4. Extract the Attio path into an adapter-shaped module without changing behavior.
5. Add a HubSpot warm-lead adapter using the existing normalized signal contract.
6. Create a `templates/default` folder from the current app shape.
7. Start writing docs as if this is the open-source AI SDR framework.

## Strategic Bet

The hard commercial truth is that most companies do not want to edit prompts in a black-box SDR. They want the agent to match their actual GTM system.

The open-source framework wins if it lets technical GTM teams say:

> We do not need to buy a generic AI SDR. We can build the exact SDR motion we want, with our sources, our CRM, our policies, our models, and our deployment boundary.

That is the opportunity.
