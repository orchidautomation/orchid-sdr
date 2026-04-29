# Trellis

Trellis is a composable agentic GTM framework.

Developed by Orchid Labs.

The repo also ships a first-class workflow example for closed-won expansion at `examples/closed-won-lookalike/`.

## The Problem

Most GTM automation still falls into one of two buckets:

1. brittle one-off scripts
2. opaque AI tools that hide too much logic behind one prompt

That creates the same failure mode every time:

- hard to inspect
- hard to extend
- hard to swap providers
- hard to operate safely
- hard to hand to coding agents without breaking the workflow

Trellis exists to make GTM workflows feel like software instead of fragile glue.

## What Trellis Is

Trellis gives you the primitives to build agentic GTM systems with explicit structure:

- signals
- state
- knowledge
- skills
- providers
- MCP control
- deployable workflows

That means you can compose different systems from the same substrate:

- AI SDR
- meeting prep
- account research
- customer success copilots
- expansion and renewal flows
- competitor monitoring
- pipeline intelligence
- GTM analytics and recommendation systems
- internal GTM copilots

## Mental Model

```text
                         +----------------------+
                         |      knowledge       |
                         |  product / ICP / USP |
                         +----------+-----------+
                                    |
                                    v
inputs --> resolve --> research --> reason --> act --> persist --> inspect
  |           |            |           |         |         |          |
  |           |            |           |         |         |          |
  v           v            v           v         v         v          v
signals    identity    search/extract skills   email     state      MCP
CRM data   accounts    browser        policy   CRM       Convex     dashboard
docs       people      retrieval      models   handoff   Rivet      agents
warehouse  context     enrichment     rules    updates   history    copilots
```

The important point is not "AI SDR."

The important point is that GTM workflows are assembled from clear parts that can be inspected, tested, swapped, and operated.

Trellis should support both:

- execution loops
  - capture context
  - reason about it
  - take constrained action
  - persist state
- intelligence loops
  - ingest activity
  - normalize entities and outcomes
  - compute recommendations
  - expose answers through MCP

## What Lives Here

This repo has two distinct layers:

```text
packages/            framework + provider modules + CLI + MCP package
examples/ai-sdr/     reference GTM agent app built on Trellis
docs/                product, deployment, and architecture docs
```

- `packages/`
  - framework contracts
  - provider modules
  - CLI
  - MCP packaging
  - default SDR substrate in `packages/default-sdr/`
  - default Convex substrate in `packages/convex/`
- `examples/ai-sdr/`
  - the reference AI SDR application
  - concrete example of discovery, research, qualification, state, CRM, email, and handoff

## Fastest Ways To See It

### 1. Run one concrete AI SDR demo

If you want the least confusing path, do not start by scaffolding a custom app.

Start with the reference AI SDR already in this repo:

1. fill the minimum env for the reference app
2. keep `NO_SENDS_MODE=true`
3. deploy the app
4. verify `/healthz` and `/dashboard`
5. connect remote MCP
6. ingest one signal
7. review state, research, and drafts before enabling any send lane

Useful commands:

```bash
npm run ai-sdr:demo:smoke
npm run ai-sdr:demo:check
```

- `ai-sdr:demo:smoke`
  - starts the reference AI SDR in local smoke mode
  - verifies `/healthz`, dashboard auth/state, `/mcp/trellis`, and one safe signal ingest
  - keeps `NO_SENDS_MODE=true`, so the flow stops safely without outbound
- `ai-sdr:demo:check`
  - runs against an already-running local or deployed app
  - adds one `/webhooks/signals` ingest check and verifies dashboard visibility

The shorter aliases still exist:

```bash
npm run demo:smoke
npm run demo:check
```

Use these docs in this order:

- [docs/getting-started.md](docs/getting-started.md)
- [docs/ai-sdr-go-live.md](docs/ai-sdr-go-live.md)
- [docs/convex-vercel-prod-runbook.md](docs/convex-vercel-prod-runbook.md)
- [examples/ai-sdr/README.md](examples/ai-sdr/README.md)

### 2. Read the reference app

Start here:

- [examples/ai-sdr/README.md](examples/ai-sdr/README.md)
- [docs/ownership-model.md](docs/ownership-model.md)
- [docs/turnkey-roadmap.md](docs/turnkey-roadmap.md)
- [docs/extraction-plan.md](docs/extraction-plan.md)

### 3. Scaffold a new Trellis app

```bash
npm run ai-sdr -- init ../my-trellis-agent --name my-trellis-agent --json
```

For the current reference AI SDR shape:

```bash
npm run ai-sdr -- init ../my-ai-sdr \
  --name my-ai-sdr \
  --with-discovery \
  --with-deep-research \
  --with-enrichment \
  --with-crm \
  --with-email \
  --with-handoff \
  --json
```

### 3. Use the guided plugin

The CLI is the machine contract.

The guided onboarding layer lives in the Trellis plugin:

- [trellis-plugin repo](https://github.com/orchidautomation/trellis-plugin)
- [latest release](https://github.com/orchidautomation/trellis-plugin/releases/latest)

Direct install scripts:

- [Claude Code](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-claude-code.sh)
- [Cursor](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-cursor.sh)
- [Codex](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-codex.sh)
- [OpenCode](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-opencode.sh)
- [All hosts](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-all.sh)

Example:

```bash
curl -fsSL https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-cursor.sh | bash
curl -fsSL https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-opencode.sh | bash
```

## Common Commands

Run these from the repo root:

```bash
npm run dev
npm run doctor
npm run typecheck
npm test
npm run ai-sdr -- modules --json
npm run ai-sdr -- check --json
```

## Minimum Demo Stack

For one safe hosted AI SDR demo, the minimum practical stack is:

```text
Convex            state plane
Rivet             actor runtime
Vercel Sandbox    isolated agent execution
Vercel AI Gateway model routing
Firecrawl         search + extract
```

Useful next providers for a fuller demo:

```text
Apify      discovery
Prospeo    enrichment
Attio      CRM sync
AgentMail  outbound + replies
Slack      handoff
```

Keep `NO_SENDS_MODE=true` until you have verified:

- `/healthz`
- `/dashboard`
- remote MCP
- one ingested signal
- one persisted prospect thread
- one research brief
- one draft, if outbound is enabled

## Why This Exists

Trellis is for teams that want:

- coding-agent-friendly GTM infrastructure
- explicit skills and knowledge
- swappable providers
- durable state
- MCP-first operations
- deployable workflows with guardrails
- a reusable substrate for many GTM applications

The reference AI SDR is the first concrete example, not the boundary of the framework.

## Read Next

- [examples/ai-sdr/README.md](examples/ai-sdr/README.md)
- [examples/closed-won-lookalike/README.md](examples/closed-won-lookalike/README.md)
- [docs/ownership-model.md](docs/ownership-model.md)
- [docs/turnkey-roadmap.md](docs/turnkey-roadmap.md)
- [docs/ai-sdr-go-live.md](docs/ai-sdr-go-live.md)
- [docs/extraction-plan.md](docs/extraction-plan.md)
- [docs/getting-started.md](docs/getting-started.md)
- [docs/new-user-guide.md](docs/new-user-guide.md)
- [docs/framework-primitives.md](docs/framework-primitives.md)
- [docs/self-hosting.md](docs/self-hosting.md)
