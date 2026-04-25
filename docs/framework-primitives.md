# Framework Primitives

This page describes the emerging modular shape of Orchid SDR.

The target user is a GTM engineer, RevOps engineer, or technical founder using a coding agent such as Codex or Claude Code to assemble a custom AI SDR from reliable primitives.

The goal is not to make every company use the same SDR. The goal is to give teams the blocks to build the exact GTM motion they need.

## Mental Model

An AI SDR is a stateful workflow made from a few composable parts:

```text
signals -> prospects -> threads -> skills -> providers -> MCP tools
```

Those parts should be explicit enough that a coding agent can safely modify, extend, test, and deploy them.

## Current Config Surface

The root [ai-sdr.config.ts](../ai-sdr.config.ts) file describes this deployment as a framework-style app:

- knowledge files
- tracked skills
- provider modules
- campaigns
- required environment variables

This is intentionally thin today. Over time it should evolve from descriptive metadata into the runtime composition layer for the framework.

The config surface is schema-backed in [src/framework/index.ts](../src/framework/index.ts):

```ts
aiSdrConfigSchema
aiSdrModuleDefinitionSchema
aiSdrProviderDefinitionSchema
aiSdrSkillDefinitionSchema
aiSdrKnowledgeDefinitionSchema
defineAiSdr
validateAiSdrConfigReferences
```

That matters because future CLI commands and coding agents need a runtime-verifiable shape, not only TypeScript hints.

Current provider modules are defined in [src/framework/builtin-modules.ts](../src/framework/builtin-modules.ts). Each module can bundle:

- provider definitions
- provider keys
- capability IDs
- normalized framework contracts
- env vars
- docs
- future smoke checks
- package names for future extraction

That is the beginning of the `ai-sdr add <capability> <provider>` shape.

MVP capability IDs:

```text
crm
email
source
search
extract
enrichment
runtime
model
handoff
observability
compliance
```

Platform capabilities such as `database` and `mcp` are also modeled because a self-hosted SDR needs durable state and a tool surface. They are not GTM motions by themselves, but they should still be packages.

Contract examples:

```text
signal.normalized.v1
crm.prospectSync.v1
crm.stageUpdate.v1
email.outbound.v1
database.postgres.v1
research.extract.v1
research.monitor.v1
runtime.sandbox.v1
```

This lets a future Salesforce, HubSpot, or Nango-backed module say exactly which normalized surfaces it supports.

## Signals

Signals are normalized events that start or update a GTM workflow.

Examples:

- HubSpot form submission
- LinkedIn public post
- X/Twitter post
- job post
- website visitor
- funding event
- CSV row
- manual Slack submission

The shared signal contract lives in [src/framework/signals.ts](../src/framework/signals.ts).

Core schema:

```ts
normalizedSignalSchema
signalWebhookPayloadSchema
providerSignalSchema
```

The generic webhook path uses the same contract as provider adapters, so new sources can be added without inventing a new ingestion shape every time.

## Providers

Providers are swappable integrations.

Examples:

- CRM: Attio, HubSpot, Salesforce, Twenty
- Email: AgentMail, Gmail, Outlook, custom SMTP/API
- Database: Neon Postgres, Supabase Postgres, RDS Postgres, self-hosted Postgres
- Search: Parallel, Firecrawl, search APIs, browser/sandbox tools
- Extract: Parallel, Firecrawl, browser/sandbox tools
- Enrichment: Parallel, Prospeo, Clay, custom data providers
- Discovery: Apify, first-party sources, custom webhooks
- Runtime: local, Vercel Sandbox, another cloud code harness
- Model: Vercel AI Gateway, OpenAI, Anthropic, OpenRouter, local models

The early executable contracts live in [src/framework/provider-contracts.ts](../src/framework/provider-contracts.ts).

CRM normalization is covered separately in [CRM Normalization](crm-normalization.md). That layer keeps Salesforce, HubSpot, Twenty, Attio, and Nango-backed adapters from leaking vendor-specific shapes into the core SDR workflow.

Current contract examples:

```ts
DiscoverySignalSourceAdapter
EmailEnrichmentProvider
BasicResearchSearchProvider
ConfigurableResearchSearchProvider
WebExtractProvider
OutboundEmailProvider
CrmProvider
HandoffProvider
```

Existing adapters are starting to implement these contracts directly. That creates a path toward packages such as:

```text
@ai-sdr/attio
@ai-sdr/hubspot
@ai-sdr/agentmail
@ai-sdr/parallel
@ai-sdr/firecrawl
@ai-sdr/neon
@ai-sdr/apify-linkedin
@ai-sdr/twenty
```

Current MVP package targets:

| Command | Package | Capabilities |
| --- | --- | --- |
| `ai-sdr add crm attio` | `@ai-sdr/attio` | `crm` |
| `ai-sdr add email agentmail` | `@ai-sdr/agentmail` | `email` |
| `ai-sdr add source apify` | `@ai-sdr/apify-linkedin` | `source` |
| `ai-sdr add source webhook` | `@ai-sdr/webhooks` | `source` |
| `ai-sdr add search parallel` | `@ai-sdr/parallel` | `search`, `extract`, `enrichment`, `source` |
| `ai-sdr add extract firecrawl` | `@ai-sdr/firecrawl` | `search`, `extract` |
| `ai-sdr add database neon` | `@ai-sdr/neon` | `database` |
| `ai-sdr add model vercel-ai-gateway` | `@ai-sdr/vercel-ai-gateway` | `model` |
| `ai-sdr add runtime vercel-sandbox` | `@ai-sdr/vercel-sandbox` | `runtime` |
| `ai-sdr add handoff slack` | `@ai-sdr/slack` | `handoff` |
| `ai-sdr add mcp orchid-mcp` | `@ai-sdr/mcp` | `mcp` |

Provider packages can satisfy more than one capability. The CLI should install by capability/provider pair, while the package remains provider-owned:

- `ai-sdr add search parallel` installs `@ai-sdr/parallel`.
- `ai-sdr add extract parallel` also installs `@ai-sdr/parallel`.
- `ai-sdr add enrichment parallel` also installs `@ai-sdr/parallel`.
- `ai-sdr add search firecrawl` installs `@ai-sdr/firecrawl`.
- `ai-sdr add extract firecrawl` also installs `@ai-sdr/firecrawl`.
- Neon maps to `database` and satisfies the current Postgres state contract through `DATABASE_URL`.

`research` remains a CLI alias for search/extract/enrichment so `ai-sdr add research parallel` can still work, but manifests should use the granular capability IDs.

## Skills

Skills are the agent's operating judgment.

Today they live under `skills/`:

- `icp-qualification`
- `research-brief`
- `research-checks`
- `sdr-copy`
- `reply-policy`
- `handoff-policy`

In the framework direction, skills should become composable modules that a GTM engineer can add, remove, version, and test.

Example future commands:

```bash
npx ai-sdr add skill product-routing
npx ai-sdr add skill enterprise-compliance
npx ai-sdr add skill founder-led-copy
```

## MCP Tools

The first-party MCP server is the control surface for operators and agents.

It lets a coding agent inspect and manipulate the live SDR system through typed tools instead of guessing against a database or dashboard.

Important tool groups:

- pipeline inspection
- lead/thread inspection
- research and qualification
- mail preview/send/reply
- CRM sync
- runtime flags
- discovery controls
- handoff

This is a major differentiator: a GTM engineer can use Codex or Claude Code to operate and extend the SDR through the same typed interface the system exposes to agents.

## How A GTM Engineer Should Use This

The intended workflow:

1. Clone or scaffold an AI SDR project.
2. Describe the company's ICP and product in `knowledge/`.
3. Add providers for the actual stack.
4. Add skills that encode the company's judgment.
5. Run `npm run doctor`.
6. Run in `NO_SENDS_MODE=true`.
7. Feed real signals into the system.
8. Inspect outcomes through MCP and the dashboard.
9. Iterate with Codex or Claude Code.
10. Only enable sends after the workflow is proven.

Future ideal:

```bash
npx create-ai-sdr@latest profound-sdr
cd profound-sdr
npx ai-sdr add source hubspot
npx ai-sdr add crm attio
npx ai-sdr add email agentmail
npx ai-sdr add search parallel
npx ai-sdr add extract firecrawl
npx ai-sdr add enrichment parallel
npx ai-sdr add database neon
npx ai-sdr add skill product-routing
npx ai-sdr doctor
```

The current repo has a local prototype for this CLI shape:

```bash
npm run ai-sdr -- modules
npm run ai-sdr -- add crm attio
npm run ai-sdr -- add search parallel
npm run ai-sdr -- add extract firecrawl
npm run ai-sdr -- add database neon
```

For now, `add` prints an install plan rather than mutating files.

## Current Boundary Between App And Framework

Current app-specific code:

- database repository
- dashboard
- Orchid-specific MCP tool implementation
- current product knowledge
- current skills
- current provider instantiation

Emerging framework code:

- `src/framework/index.ts`
- `src/framework/signals.ts`
- `src/framework/provider-contracts.ts`
- `ai-sdr.config.ts`
- `scripts/doctor.ts`

The next step is to keep moving stable contracts into `src/framework/` while leaving customer- or deployment-specific behavior in the app layer.

## Design Rule

Anything a future `npx ai-sdr add <thing>` command would need should become a typed contract, schema, test, or config entry.

That is the path from a single working Orchid SDR repo to an open-source framework for agentic GTM.
