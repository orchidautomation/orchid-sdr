# Framework Primitives

This page describes the main framework contracts behind the Trellis reference AI SDR. It is written for GTM engineers and developers extending the system with coding agents or direct code changes.

## Mental Model

An AI SDR deployment is composed from a small set of explicit parts:

```text
signals -> prospects -> threads -> skills -> providers -> MCP tools
```

Each part is designed to be inspectable, testable, and replaceable.

## Configuration Surface

The root [ai-sdr.config.ts](../ai-sdr.config.ts) file describes a deployment in framework terms:

- knowledge files
- tracked skills
- provider modules
- campaigns
- required environment variables

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

Use this file as the primary composition point when changing providers, enabling modules, or preparing a deployment for automation.

Current provider modules are defined in [src/framework/builtin-modules.ts](../src/framework/builtin-modules.ts). A module can bundle:

- provider definitions
- provider keys
- capability IDs
- normalized contracts
- environment variables
- docs
- smoke checks
- package names for extracted providers

## Capability Model

The CLI and framework use capability IDs to describe what a provider supplies.

MVP capability IDs:

```text
crm
email
source
state
search
extract
enrichment
runtime
model
handoff
observability
compliance
```

Platform capabilities such as `database` and `mcp` are modeled separately because a self-hosted SDR needs durable state and an operator tool surface.

The default stack uses Convex as `state` and Rivet as `runtime`. See [Agent-Native Architecture](agent-native-architecture.md).

Contract examples:

```text
signal.normalized.v1
crm.prospectSync.v1
crm.stageUpdate.v1
email.outbound.v1
state.reactive.v1
state.workflow.v1
state.agentThreads.v1
research.extract.v1
research.monitor.v1
runtime.actor.v1
runtime.sandbox.v1
```

These contracts let different providers implement the same workflow surface without leaking vendor-specific behavior into the core app.

## Signals

Signals are normalized events that start or update SDR workflows.

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

The generic webhook path and provider adapters share the same contract so new sources can be added without defining a new ingest shape each time.

## Providers

Providers are swappable integrations behind the main workflow surfaces.

Examples:

- CRM: Attio, HubSpot, Salesforce, Twenty
- Email: AgentMail, Gmail, Outlook, custom SMTP or API
- State: Convex
- Search: Parallel, Firecrawl, search APIs, browser or sandbox tools
- Extract: Parallel, Firecrawl, browser or sandbox tools
- Enrichment: Parallel, Prospeo, Clay, custom data providers
- Discovery: Apify, first-party sources, custom webhooks
- Runtime: Rivet actors, local development, Vercel Sandbox, other cloud code harnesses
- Model: Vercel AI Gateway, OpenAI, Anthropic, OpenRouter, local models

The early executable contracts live in [src/framework/provider-contracts.ts](../src/framework/provider-contracts.ts).

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

These contracts support package extraction for providers such as:

```text
@ai-sdr/attio
@ai-sdr/hubspot
@ai-sdr/agentmail
@ai-sdr/convex
@ai-sdr/parallel
@ai-sdr/firecrawl
@ai-sdr/neon
@ai-sdr/apify-linkedin
@ai-sdr/twenty
```

### CLI Mapping

Current package targets:

| Command | Package | Capabilities |
| --- | --- | --- |
| `ai-sdr add crm attio` | `@ai-sdr/attio` | `crm` |
| `ai-sdr add email agentmail` | `@ai-sdr/agentmail` | `email` |
| `ai-sdr add state convex` | `@ai-sdr/convex` | `state` |
| `ai-sdr add source apify` | `@ai-sdr/apify-linkedin` | `source` |
| `ai-sdr add source webhook` | `@ai-sdr/webhooks` | `source` |
| `ai-sdr add search parallel` | `@ai-sdr/parallel` | `search`, `extract`, `enrichment`, `source` |
| `ai-sdr add extract firecrawl` | `@ai-sdr/firecrawl` | `source`, `search`, `extract`, `enrichment`, `runtime`, `observability` |
| `ai-sdr add database neon` | `@ai-sdr/neon` | `database` |
| `ai-sdr add model vercel-ai-gateway` | `@ai-sdr/vercel-ai-gateway` | `model` |
| `ai-sdr add runtime rivet` | `@ai-sdr/rivet` | `runtime` |
| `ai-sdr add runtime vercel-sandbox` | `@ai-sdr/vercel-sandbox` | `runtime` |
| `ai-sdr add handoff slack` | `@ai-sdr/slack` | `handoff` |
| `ai-sdr add mcp trellis-mcp` | `@ai-sdr/mcp` | `mcp` |

Provider packages can satisfy more than one capability. The CLI installs by capability and provider pair while the underlying package remains provider-owned.

`research` remains a CLI alias for search, extract, and enrichment, but manifests should use the granular capability IDs.

## Minimum Runnable Stack

The reference app currently has two composition profiles:

| Profile | Purpose |
| --- | --- |
| `minimum` | Ingest one signal, research it, run model and runtime work, persist state, and expose MCP tools. |
| `productionParity` | Run the full reference workflow: state, source, research, enrichment, runtime actors, sandbox harness, model gateway, email, CRM, handoff, and MCP. |

Verification commands:

```bash
npm run ai-sdr -- check
npm run doctor
```

Use these checks after changing provider composition or preparing a deployment profile.

## Skills

Skills encode agent behavior and judgment. Current skills live under `skills/`:

- `icp-qualification`
- `research-brief`
- `research-checks`
- `sdr-copy`
- `reply-policy`
- `handoff-policy`

Developers can treat skills as a composable surface for company-specific qualification, drafting, reply handling, or routing logic.

## MCP Tools

The first-party MCP server is the operator and agent control surface.

Primary tool groups:

- pipeline inspection
- lead and thread inspection
- research and qualification
- mail preview, send, and reply
- CRM sync
- runtime flags
- discovery controls
- handoff

This interface allows external agents to inspect and control the live SDR system through typed tools instead of direct database or dashboard coupling.

## Extend The Framework

Typical developer workflow:

1. scaffold or clone an AI SDR project
2. define product and ICP context in `knowledge/`
3. add providers for the target stack
4. add or modify skills
5. run `npm run doctor`
6. test in `NO_SENDS_MODE=true`
7. feed real or test signals into the system
8. inspect behavior through MCP and the dashboard
9. iterate on providers, contracts, or skills

Current local CLI examples:

```bash
npm run ai-sdr -- modules
npm run ai-sdr -- add crm attio
npm run ai-sdr -- add state convex
npm run ai-sdr -- add search parallel
npm run ai-sdr -- add extract firecrawl
npm run ai-sdr -- add database neon
```

## Deployment Boundary

App-specific code currently includes:

- database repository
- dashboard
- Trellis MCP tool implementations
- product knowledge
- deployment-specific skills
- provider instantiation

Framework code currently includes:

- `src/framework/index.ts`
- `src/framework/signals.ts`
- `src/framework/provider-contracts.ts`
- `ai-sdr.config.ts`
- `scripts/doctor.ts`

When extending or deploying Trellis, keep reusable contracts in `src/framework/` and keep customer-specific behavior in the app layer.
