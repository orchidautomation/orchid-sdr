# Trellis v3 Vision

## Thesis

Trellis v3 is not a universal agent framework.

Trellis is a battle-hardened vertical agent stack, starting with GTM.

The job is not to expose every agent framework, runtime, database, model gateway, email provider, and sandbox as user-facing choices.

The job is to ship the thing that works.

Trellis should feel more like a product than a framework: one excellent default stack, a few business-level connection points, and a deployment path that feels boring.

Trellis v3 should feel like this:

```bash
trellis init acme-sdr
trellis deploy
trellis doctor
trellis smoke
trellis connect attio
trellis connect agentmail
trellis docs add ./product-docs
trellis connect langfuse
trellis mcp install
```

The user should not have to design the platform.

They should get a known-good stack with strong defaults, visible reliability, and clean escape hatches.

The first deploy should require only Cloudflare account auth. Attio, AgentMail, Firecrawl, and optional trace sinks connect after the app is alive.

The rule:

Compose internally. Curate externally.

For the concrete parity checklist against the current AI SDR, see [Trellis v3 AI SDR Parity Contract](trellis-v3-parity-contract.md).

## The Product Boundary

Trellis owns the vertical app contract.

Trellis does not need to own the runtime substrate.

Trellis should own:

- template layout
- markdown knowledge and skill pack format
- provider setup conventions
- GTM state and event schemas
- webhook contracts
- durable workflow conventions
- idempotency rules
- approval and no-send gates
- audit events
- smoke tests
- MCP and operator control surface
- deployment wiring
- observability conventions
- the blessed default stack

Trellis should not reinvent:

- agent harnesses
- sandbox orchestration
- container platforms
- queue systems
- databases
- object storage
- model gateways
- log pipelines
- workflow engines

Those are now platform capabilities.

Trellis v3 should compile and configure those capabilities into a reliable vertical stack.

It should not ask users to choose architecture before they have a working agent.

## Core Promise

Trellis turns markdown playbooks and provider choices into reliable vertical agent apps.

For GTM, that means a production-ready path for:

- ingesting signals
- normalizing accounts, people, companies, and opportunities
- loading product, ICP, compliance, and playbook knowledge
- researching with evidence
- qualifying against explicit criteria
- drafting outbound or follow-up actions
- requiring approval before risky actions
- sending email or creating tasks
- handling replies
- syncing CRM
- handing off to humans
- auditing every decision and side effect
- exposing the system through dashboard and MCP

This is the real value. Not generic "agents", but reliable vertical workflows with operator control.

## The 30-Line Demo

The flagship demo should show that a real GTM agent app can be readable in one screen.

Flue shows the power of the harness by building a useful agent in 20 to 30 lines.

Trellis should show the power of the full vertical stack by building a reliable GTM agent in roughly the same space.

This API is aspirational, but it is the shape v3 should optimize for:

```ts
// agents/gtm-sdr.ts
import { trellis, schema } from "@trellis/gtm";
import { attio, agentmail, firecrawl } from "@trellis/providers";

export default trellis.agent("sdr", {
  crm: attio(),
  email: agentmail(),
  research: firecrawl(),
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound(),
}, async (app) => {
  const signal = await app.signal();
  const context = await app.context(signal);
  const qualification = await app.skill("icp-qualification", {
    context,
    schema: schema.qualification(),
  });
  const research = await app.skill("research-brief", {
    context,
    args: { qualification },
    schema: schema.researchBrief(),
  });
  const draft = await app.skill("sdr-copy", {
    context,
    args: { qualification, research },
    schema: schema.outboundDraft(),
  });

  return app.workflow("prospect").start({ signal, qualification, research, draft });
});
```

That one screen should demonstrate the entire promise:

- a webhook accepts a normalized GTM signal
- D1 or Durable Object state is wired in
- R2-backed markdown knowledge and skills are mounted into the sandbox
- Flue runs the agent harness under the hood
- MCP tools are available to the agent and operators
- Attio, AgentMail, and Firecrawl are provider slots
- no-send mode and approval gates are enforced by default
- the result starts a durable prospect workflow
- every step can write audit events, traces, and smoke-testable state

Flue should be abstracted from the happy path.

The user should not need to import `FlueContext`, call `init`, create a harness, or manually manage sessions for the default GTM template.

Those primitives should remain available through an escape hatch when someone needs raw harness control:

```ts
const flue = await app.harness.raw();
```

Cloudflare should also be abstracted from the happy path.

The user should not need to think about `wrangler.jsonc`, Durable Object bindings, D1 binding names, R2 buckets, Workflows config, Queues config, AI Gateway setup, migration tags, or secret sync during the first successful deploy.

Those details should still exist in generated files and docs for advanced users.

The default product experience should be:

```bash
trellis deploy
```

The first successful deploy should require only Cloudflare credentials.

That means:

- Trellis provisions or verifies the Cloudflare app substrate.
- The generated app boots without Attio, email, or research provider credentials.
- Provider connections happen after deploy through `trellis connect ...` or the dashboard.
- The app can run smoke tests in safe local/mock mode before real GTM side effects are enabled.
- No-send mode is the default until explicit approval and provider readiness checks pass.

The point is not that Trellis hides all complexity.

The point is that the happy path for a correct GTM agent is short, legible, and production-shaped from the first file.

## The 5-Minute Walkthrough

The demo should be easy to narrate:

```bash
trellis init acme-sdr
trellis connect attio
trellis connect agentmail
trellis docs add ./product-docs
trellis add observability langfuse
trellis deploy
trellis smoke
```

Then show four things:

1. The markdown pack: `knowledge/` and `skills/` hold the GTM judgment.
2. The agent file: one readable file wires sandbox, model, MCP, database, providers, and safety.
3. The smoke run: one fixture signal creates a prospect, qualifies it, drafts the next action, and stops before send.
4. The operator surface: dashboard and MCP show the trace, state, audit events, and pending approval.

The message to GTM builders:

Most teams can make an agent demo.

Trellis gives them the missing production path: webhooks, state, retries, approval gates, provider adapters, observability, MCP, and deployment in one understandable stack.

## What The Stack Makes Possible

There is enough platform plumbing now to rebuild Trellis as a simpler system.

The likely move:

```text
Flue       -> agent harness
Cloudflare -> durable runtime, storage, webhooks, queues, models, sandbox
Trellis    -> vertical pack format, GTM contracts, safety, reliability, and operator surface
```

Trellis should not own a bespoke actor runtime, sandbox broker, model gateway wrapper, blob store, queue system, email system, and observability layer unless those are the product.

Most of that now exists as platform plumbing.

| Plumbing Need | Best Fit | What This Unlocks |
| --- | --- | --- |
| Agent harness | Flue | `agents/*.ts`, sessions, roles, skills, markdown context, typed schema outputs, MCP tools. This maps cleanly to "Trellis logic lives in markdown." |
| Markdown and skills loading | Flue + R2 + just-bash | Store `AGENTS.md`, skills, ICP docs, playbooks, and product docs in R2 or the repo. Mount them as a filesystem and let the agent use `grep`, `glob`, `read`, `rg`, `jq`, and related tools. |
| Lightweight filesystem context | just-bash / Bash Tool | Most research, support, and data-agent workflows do not need a full container. Agents can search large file context and pull only relevant snippets into the model. |
| Durable agent identity | Cloudflare Agents | One durable object per campaign, account, prospect, inbox, workspace, repo, or other business object. Built-in SQL, state, scheduling, WebSockets, and hibernation. |
| Long workflows | Cloudflare Workflows | Qualification, research, approval, send, wait-for-reply, follow-up, and handoff can be durable steps with retries, sleeps, and checkpoints. |
| Full sandboxed compute | Cloudflare Sandbox | Real Linux containers from Workers. Run Python, Node, git, background processes, file operations, terminal sessions, and code execution. Use only when just-bash is not enough. |
| Blob and object storage | Cloudflare R2 | Store markdown packs, uploaded docs, generated artifacts, transcripts, attachments, sandbox snapshots, and logs. |
| Relational app state | D1 or Durable Object SQLite | D1 for queryable global app state. Durable Object SQLite for per-agent/private state. Keep Trellis schemas, drop custom persistence plumbing. |
| Queueing and webhooks | Workers + Queues | `/webhooks/*`, email handlers, background ingest, dead-letter queues, and retries. This replaces much of the current custom webhook dispatch. |
| Model gateway | Cloudflare AI Gateway | Multi-provider routing, logs, cost and latency visibility, caching, rate limits, retries, and DLP/guardrail paths. This can replace a dedicated model gateway wrapper. |
| Email | Cloudflare Email Service, AgentMail | Cloudflare Email can cover native Workers email paths as it matures. AgentMail remains a strong first provider for agentic outbound and inbound replies. Keep the Trellis email contract. |
| Observability | Workers Logs + OpenTelemetry + AI Gateway logs | Solid infrastructure and model visibility. For agent trace UX and eval workflows, Trellis can optionally connect Langfuse or Braintrust. |
| Browser and computer actions | Cloudflare Browser Run + Sandbox | Good for web automation, screenshots, PDFs, scraping, Playwright/Puppeteer/CDP, and browser-backed research. This is not a general desktop control system. |
| Multi-agent coordination | Cloudflare Agents + Flue sessions/tasks | A coordinator agent can dispatch to sub-agents or multiple harness sessions over the same object and context. |

## Reference Stack

Trellis v3 should have one blessed default stack.

The default should be boring, production-minded, and easy to deploy.

```text
Agent harness:     Flue
Runtime:           Cloudflare Workers
Durability:        Cloudflare Agents + Durable Objects
Long workflows:    Cloudflare Workflows
State:             D1 for queryable app state, Durable Object SQLite for per-agent state
Files:             R2 for markdown packs, artifacts, transcripts, and uploaded context
Sandbox:           just-bash virtual sandbox by default, Cloudflare Sandbox for full Linux
Models:            Cloudflare AI Gateway
Email:             AgentMail first, Cloudflare Email as an optional native path
Research:          Firecrawl, Parallel, Browser Run
Observability:     AI Gateway logs + Workers logs/traces, optional Langfuse or Braintrust
Control plane:     Trellis MCP + dashboard
```

Other runtimes can exist later.

The first target should be excellent before it is generalized.

## Flue's Role

Flue is the agent harness.

Trellis should use Flue for:

- agent entrypoints
- sessions
- roles
- skills
- schema-shaped results
- task/sub-agent calls
- MCP client tools
- sandbox filesystem access
- just-bash integration
- Cloudflare deployment target

Flue is not the GTM product layer.

It should not know what an account, prospect, campaign, ICP, reply, opportunity, or CRM handoff is.

Trellis supplies that vertical meaning.

In Trellis v3, a GTM step should look conceptually like Trellis:

```ts
export async function qualifyProspect(app, signal) {
  return app.skill("icp-qualification", {
    context: await app.context(signal),
    schema: schema.qualification(),
  });
}
```

That is the right division:

- Flue runs the agent under the hood.
- Trellis defines the public API, pack, payload, schema, safety rules, and workflow meaning.

## Cloudflare's Role

Cloudflare is the reference runtime substrate.

The pieces map naturally:

### Workers

Workers host:

- webhook routes
- dashboard routes
- MCP routes
- health checks
- API endpoints
- lightweight orchestration

### Cloudflare Agents

Cloudflare Agents provide durable identity for long-lived business objects.

Useful object mappings:

- `WorkspaceAgent`
- `CampaignAgent`
- `ProspectAgent`
- `AccountAgent`
- `InboxAgent`
- `ResearchJobAgent`
- `OperatorSessionAgent`

These agents should own local state, coordination, and live control.

### Durable Objects

Durable Objects provide:

- per-object coordination
- local SQLite
- stateful WebSocket surfaces
- hibernation-friendly sessions
- serialized updates for one business entity

This is a better default than hand-rolled actor plumbing.

### Workflows

Cloudflare Workflows should own durable multi-step business processes.

Example GTM workflow:

```text
signal.accepted
  -> dedupe
  -> enrich_identity
  -> qualify
  -> research
  -> draft
  -> wait_for_approval
  -> send_or_task
  -> wait_for_reply
  -> classify_reply
  -> handoff_or_followup
```

Workflows are where retries, sleeps, checkpoints, and failure recovery should live.

### R2

R2 stores file-like context:

- markdown knowledge packs
- skills
- roles
- customer docs
- uploaded CSVs
- transcripts
- generated research briefs
- email previews
- artifacts
- sandbox snapshots

Trellis should treat R2 as the canonical pack/artifact store for Cloudflare deployments.

### D1

D1 stores queryable app state:

- workspaces
- campaigns
- accounts
- people
- signals
- prospects
- threads
- approvals
- audit events
- provider runs
- handoffs
- dashboard projections

Durable Object SQLite is good for local per-agent memory.

D1 is better for global dashboard and reporting queries.

### Queues

Queues handle background work and retry boundaries:

- webhook fanout
- provider run completion
- bulk ingest
- enrichment jobs
- outbound send jobs
- observability export
- dead-letter handling

### AI Gateway

AI Gateway should be the default model gateway.

It should provide:

- model routing
- usage logs
- provider abstraction at the edge
- caching where safe
- rate limits
- cost visibility
- request tracing
- fallback policy

Trellis should not hide model providers completely. It should make sane routing easy and observable.

### Cloudflare Sandbox

Cloudflare Sandbox is for full Linux execution.

Use it for:

- coding agents
- browser-heavy workflows
- package installs
- git operations
- Python/Node execution
- long-running file operations
- complex data processing

Do not use it for everything.

The default should be lighter.

### just-bash

just-bash is the default local/virtual filesystem tool.

Use it for:

- markdown retrieval
- grep/glob/read
- simple file writes
- lightweight data analysis
- filesystem-based context
- skills and AGENTS.md loading

Most vertical agent steps should not need a full container.

### Browser Run

Browser Run or browser-like Cloudflare tooling should handle:

- page inspection
- screenshots
- PDF generation
- browser automation
- authenticated browser sessions where appropriate

This is a provider slot, not core Trellis logic.

### Email

Email should stay provider-backed.

The first path can remain AgentMail because it is purpose-built for agentic outbound and inbound replies.

Cloudflare Email should become a native optional module when it is mature enough for the required workflow:

- outbound transactional sends
- inbound routing to Workers
- reply classification
- sender/domain setup
- deliverability controls

Trellis should preserve the email contract and make provider swaps safe.

### Observability

Trellis v3 should have observability from day one.

Minimum trace shape:

- trace id
- workflow id
- workspace id
- campaign id
- account id
- prospect id
- provider
- model
- prompt/skill version
- stage
- latency
- tokens
- cost
- retries
- errors
- approval status
- side effects

Default stack:

- Cloudflare AI Gateway logs for model calls
- Workers logs/traces for infrastructure
- D1 audit events for product-visible history
- optional Langfuse or Braintrust for AI trace UX and eval loops

The invariant is more important than the vendor:

Every workflow step and side effect must be inspectable.

## Reliability Is The Framework

The framework is not a clever abstraction layer.

The framework is reliability.

Trellis v3 earns its keep by making these things automatic:

- env validation
- provider readiness checks
- webhook signature validation
- idempotency keys
- dedupe rules
- retry policy
- dead-letter queues
- workflow checkpoints
- durable sleeps
- approval gates
- no-send mode
- kill switches
- least-privilege provider access
- audit events
- trace propagation
- smoke tests
- deploy verification
- MCP inspection

That is what users actually need.

Anyone can make an agent demo.

Trellis should make the demo survive contact with production.

## Compose Internally, Curate Externally

Trellis v3 should not expose architecture choices in the happy path.

It should expose the business choices users actually care about:

- CRM
- email account
- product docs
- ICP
- approval rules
- handoff destination
- allowed domains
- observability backend

It can keep provider slots internally:

- CRM provider
- email provider
- research provider
- model/provider routing
- observability backend
- knowledge source

But the default user experience should not ask people to assemble architecture.

Good:

```bash
trellis connect attio
trellis connect agentmail
trellis docs add ./product-docs
trellis connect langfuse
```

Bad:

```bash
trellis configure-abstract-runtime-storage-provider-coordinator
```

The stack should be understandable because it is concrete.

## v3 Project Layout

Suggested generated app:

```text
my-agent/
  trellis.config.ts
  wrangler.jsonc
  package.json
  .env.example

  agents/
    qualify.ts
    research.ts
    draft.ts
    reply.ts
    handoff.ts

  workflows/
    prospect.workflow.ts
    campaign.workflow.ts

  knowledge/
    product.md
    icp.md
    compliance.md
    usp.md
    handoff.md
    negative-signals.md

  skills/
    icp-qualification/SKILL.md
    research-brief/SKILL.md
    sdr-copy/SKILL.md
    reply-policy/SKILL.md
    handoff-policy/SKILL.md

  providers/
    crm.ts
    email.ts
    research.ts

  state/
    schema.ts
    migrations/

  mcp/
    tools.ts
    server.ts

  dashboard/
    app.ts

  tests/
    smoke.test.ts
    fixtures/
```

The generated app is normal TypeScript.

Users can edit it.

Trellis should not trap users inside a black box.

## CLI Shape

The CLI should feel like a deployment assistant and reliability compiler.

### Init

```bash
trellis init acme-sdr
```

Creates:

- GTM agent layout
- Cloudflare Worker config hidden behind Trellis defaults
- R2/D1/DO/Workflow bindings
- base GTM markdown pack
- state schema
- MCP server
- dashboard shell
- smoke test suite

### Connect

```bash
trellis connect attio
trellis connect agentmail
trellis docs add ./product-docs
trellis add observability langfuse
```

Each connect command should:

- write a non-secret provider manifest under `.trellis/providers/`
- leave secrets in env, Wrangler secrets, or the dashboard
- add env vars
- add provider readiness check
- add smoke test
- update MCP tool catalog if relevant
- update dashboard capability state

`trellis docs add` writes `.trellis/knowledge-pack.json` with markdown file paths, byte sizes, and hashes. That gives `doctor`, `smoke`, and deploy a concrete artifact to verify before the pack is synced into `TRELLIS_PACKS`.

### Doctor

```bash
trellis doctor
```

Checks:

- env vars
- provider auth
- Cloudflare bindings
- migrations
- webhook secrets
- model gateway
- R2 pack loading
- D1 connectivity
- workflow registration
- MCP auth

### Deploy

```bash
trellis deploy
```

Runs:

- typecheck
- tests
- migration plan
- Cloudflare deploy
- secret sync guidance
- post-deploy health check

### Smoke

```bash
trellis smoke
```

Runs a real safe workflow:

- ingest fixture signal
- create prospect
- load markdown pack
- run qualification
- write audit event
- create draft
- stop before send
- inspect through MCP/dashboard

The smoke test is part of the product.

### Doctor

```bash
trellis doctor
```

Checks the generated Cloudflare app shape:

- Wrangler config
- required Cloudflare bindings
- knowledge and skill pack folders
- first-boot provider posture
- safe fixture smoke workflow
- no-send and approval defaults

## GTM As The First Vertical

GTM is the right first vertical because it has:

- clear business objects
- expensive mistakes
- many provider integrations
- repeatable workflows
- obvious need for approval gates
- obvious audit requirements
- measurable outcomes
- strong value from workflow reliability

The first template should be GTM.

Later templates can be extracted only if the pattern proves itself:

- support
- recruiting
- customer success
- data analyst
- compliance review
- internal operations

Do not build generic core by guessing.

Extract generic core from working verticals.

## What To Cut From The Current Direction

Cut or reduce:

- custom actor runtime ambition
- too many runtime package abstractions
- too many theoretical provider contracts
- framework language that suggests "build anything"
- bespoke sandbox broker as a core primitive
- default dependence on a specific code-harness agent
- abstractions that exist only to swap already-good infrastructure

Keep:

- normalized signal contracts
- provider setup and readiness
- GTM state model
- skills and knowledge pack
- no-send and approval gates
- audit trail
- MCP tools
- dashboard/operator controls
- smoke tests
- deployment runbooks

The new question for every feature:

Does this make the vertical agent more reliable, observable, deployable, or easier to install?

If not, it probably does not belong in v3.

## Migration Path

Do not rewrite everything at once.

### Phase 1: Prove The New Inner Loop

Build a Cloudflare + Flue spike that:

- loads Trellis markdown skills from R2 or local files
- runs one qualification skill
- returns schema-shaped output
- writes an audit event
- exposes result through a small MCP tool

### Phase 2: Replace Sandbox Broker

Replace the current Vercel Sandbox / Claude broker with a Flue-backed harness behind the existing `runSandboxTurn` shape.

### Phase 3: Replace Runtime Dispatch

Move prospect-thread orchestration from Rivet actors to Cloudflare Agents and Workflows.

Preserve the public workflow contracts while changing the substrate.

### Phase 4: Make The CLI The Product

Make `trellis init`, `trellis connect`, `trellis docs add`, `trellis deploy`, and `trellis smoke` excellent.

The CLI should generate and verify the full stack.

Legacy composition commands can remain during migration only behind explicit legacy/development paths. They should not appear in the default help, scaffold, or first-run story.

### Phase 5: Package The GTM Template

Ship GTM as the default product experience.

The template should be opinionated and safe by default.

## Decision Principles

1. Prefer one excellent default stack over many half-supported stacks.
2. Use platform primitives instead of reimplementing them.
3. Keep Trellis-owned code close to vertical reliability.
4. Treat markdown packs as product logic.
5. Treat smoke tests as first-class generated assets.
6. Keep user escape hatches in normal TypeScript.
7. Abstract only when it prevents bugs or saves real setup time.
8. Make every side effect auditable.
9. Make every workflow resumable or recoverable.
10. Make deployment boring.

## One-Line Vision

Trellis v3 is the easiest way to ship a reliable GTM agent app from markdown playbooks, provider choices, and a battle-tested Cloudflare + Flue runtime stack.

## Useful References

- Flue: https://github.com/withastro/flue
- Flue Cloudflare deployment: https://github.com/withastro/flue/blob/main/docs/deploy-cloudflare.md
- just-bash: https://github.com/vercel-labs/just-bash
- Vercel Bash Tool: https://vercel.com/changelog/introducing-bash-tool-for-filesystem-based-context-retrieval
- Cloudflare Agents: https://developers.cloudflare.com/agents/
- Cloudflare Workflows: https://developers.cloudflare.com/workflows/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Cloudflare R2: https://developers.cloudflare.com/r2/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare AI Gateway: https://developers.cloudflare.com/ai-gateway/
- Cloudflare Sandbox: https://developers.cloudflare.com/sandbox/
- Cloudflare Email Service: https://developers.cloudflare.com/email-service/
- Cloudflare Browser Run: https://developers.cloudflare.com/browser-run/
