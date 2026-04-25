# Agent-Native Architecture

This page defines the default architecture direction for the open-source AI SDR framework.

The goal is an opinionated best-in-class stack that works out of the box, while still letting technical teams swap providers when they have strong preferences.

## Default Stack

```text
Convex        -> reactive source of truth
Rivet         -> live agent runtime and actor/control plane
AI Gateway    -> model routing plane
MCP           -> tool capability plane
Skills        -> judgment and policy layer
Provider pkgs -> swappable GTM integrations
YAML/config   -> agent-editable composition layer
```

This is the default because it gives a GTM engineer a complete agent-native system without making them choose every primitive up front.

## Plane Ownership

### Convex: State Plane

Convex should own canonical business state:

- organizations, users, auth, and seats
- `ai-sdr.yaml` or compiled module config
- campaigns and runtime flags
- signals
- accounts, contacts, prospects, and leads
- research evidence and source provenance
- qualification decisions
- outbound drafts and approvals
- thread and message history
- agent memory
- workflow checkpoints
- audit and usage logs
- live dashboard queries

Convex is the right default state plane because its database is reactive, queries and mutations are TypeScript, mutations are transactional, and clients subscribe to live query results. Convex also has an Agent component for threads, messages, tools, RAG, workflows, human agents, usage tracking, and rate limiting.

Useful docs:

- Convex overview: https://docs.convex.dev/understanding
- Convex AI Agents: https://docs.convex.dev/agents
- Convex workflows: https://docs.convex.dev/agents/workflows

### Rivet: Runtime Plane

Rivet should own active execution:

- per-campaign actors
- per-lead orchestration actors
- queues, rate limits, and backpressure
- sandbox/code-harness sessions
- tool execution loops
- long-running research and qualification work
- retries and active workflow control
- live progress events before canonical commits
- harness hot-swapping: Codex, Claude Code, OpenCode, Vercel Sandbox, future runtimes

Rivet is the right default runtime plane because actors are long-lived, stateful compute with realtime, queues, workflow loops, and strong fit for AI agents, sandboxes, and workflow automation.

Useful docs:

- Rivet Actors overview: https://rivet.dev/docs/actors/

### AI Gateway: Model Plane

The AI Gateway should be the default model router.

It gives the framework one provider surface for structured model calls and sandbox agent turns, while still letting a deployment swap to OpenAI, Anthropic, OpenRouter, local models, or another gateway.

### MCP: Tool Plane

MCP should describe what agents can do.

Provider modules can mount external MCP servers such as Parallel and Firecrawl, while the first-party `orchid-sdr` MCP exposes internal tools for pipeline state, lead inspection, mail preview/send, CRM sync, runtime flags, and handoff.

Provider MCP tools are indexed in [MCP Capability Index](mcp-capability-index.md).

### Skills: Judgment Plane

Skills should encode company judgment:

- ICP qualification
- research sufficiency
- source reliability
- product routing
- copy style
- reply handling
- compliance
- handoff policy

Skills should remain easy for coding agents to edit, test, and version.

## No Collision Rule

Convex and Rivet collide only if both become canonical sources of truth.

The rule:

```text
Convex stores what happened.
Rivet makes things happen.
```

Rivet actors may keep active runtime state, but canonical business records should be written to Convex.

Examples:

| Data | Canonical Owner | Runtime Owner |
| --- | --- | --- |
| campaign config | Convex | Rivet caches active config |
| lead/prospect record | Convex | Rivet processes a lead actor |
| research evidence | Convex | Rivet runs research tools |
| agent thread/messages | Convex | Rivet executes a live session |
| rate-limit queue | Convex stores policy/audit | Rivet enforces active queue |
| sandbox session | Convex stores transcript/result | Rivet controls live sandbox |
| dashboard state | Convex live queries | Rivet streams transient progress |

If a value needs to survive as product truth, write it to Convex. If a value exists to coordinate active work, Rivet can own it.

## Lifecycle

```text
1. Signal lands in Convex.
2. Convex mutation normalizes and stores the signal.
3. Convex schedules or emits work for the relevant campaign.
4. Rivet actor picks up the lead/campaign work.
5. Rivet runs provider tools through MCP, adapters, and harnesses.
6. Rivet writes checkpoints, evidence, decisions, and transcripts back to Convex.
7. Convex live queries update the dashboard and agent/operator views.
8. MCP exposes both canonical state and safe actions to coding agents.
```

## Default Modules

The default stack should compile from module commands such as:

```bash
ai-sdr add state convex
ai-sdr add runtime rivet
ai-sdr add model vercel-ai-gateway
ai-sdr add search parallel
ai-sdr add extract firecrawl
ai-sdr add email agentmail
ai-sdr add crm attio
ai-sdr add handoff slack
ai-sdr add mcp orchid-mcp
```

Optional swaps:

```bash
ai-sdr add state neon
ai-sdr add harness opencode
ai-sdr add model openrouter
ai-sdr add crm salesforce
ai-sdr add crm hubspot
```

## Future YAML Shape

```yaml
name: profound-sdr

state:
  provider: convex
  package: "@ai-sdr/convex"

runtime:
  provider: rivet
  package: "@ai-sdr/rivet"

model:
  provider: vercel-ai-gateway
  package: "@ai-sdr/vercel-ai-gateway"

modules:
  - capability: source
    provider: hubspot
  - capability: crm
    provider: salesforce
  - capability: email
    provider: agentmail
  - capability: search
    provider: parallel
  - capability: extract
    provider: firecrawl

skills:
  - icp-qualification
  - research-brief
  - sdr-copy
  - reply-policy
```

The YAML should be the human and agent-editable composition file. The TypeScript config can remain the compiled, typed implementation target.

## Sign-Up Flow

For a hosted version:

1. Create workspace.
2. Choose default stack or advanced mode.
3. Connect CRM.
4. Connect email.
5. Connect lead sources.
6. Connect research providers.
7. Import product, ICP, compliance, and handoff knowledge.
8. Generate initial skills and campaign config.
9. Run a simulated lead through research, qualification, copy, CRM sync, and handoff.
10. Launch in safe mode with sends disabled.
11. Review live Convex-backed dashboard state and MCP tool output.
12. Enable approved sends only after smoke checks pass.

For open source:

```bash
npx create-ai-sdr@latest my-sdr
cd my-sdr
ai-sdr add state convex
ai-sdr add runtime rivet
ai-sdr add search parallel
ai-sdr add extract firecrawl
ai-sdr add email agentmail
ai-sdr doctor
ai-sdr dev
```

## Next Implementation Milestones

1. Add `@ai-sdr/convex` package boundary and generated Convex schema/functions.
2. Move canonical signal/prospect/thread state behind a state-plane contract.
3. Keep Rivet actors focused on live execution and checkpoint back to Convex.
4. Generate sandbox MCP config from module manifests.
5. Add YAML parsing and compilation into `ai-sdr.config.ts`.
6. Split provider packages out of the reference app.
