# Trellis

Trellis is a composable agentic GTM framework.

Developed by Orchid Labs.

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
- `examples/ai-sdr/`
  - the reference AI SDR application
  - concrete example of discovery, research, qualification, state, CRM, email, and handoff

## Fastest Ways To See It

### 1. Read the reference app

Start here:

- [examples/ai-sdr/README.md](examples/ai-sdr/README.md)
- [docs/ownership-model.md](docs/ownership-model.md)
- [docs/turnkey-roadmap.md](docs/turnkey-roadmap.md)
- [docs/ai-sdr-go-live.md](docs/ai-sdr-go-live.md)
- [docs/extraction-plan.md](docs/extraction-plan.md)

### 2. Scaffold a new Trellis app

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
- [docs/ownership-model.md](docs/ownership-model.md)
- [docs/turnkey-roadmap.md](docs/turnkey-roadmap.md)
- [docs/ai-sdr-go-live.md](docs/ai-sdr-go-live.md)
- [docs/extraction-plan.md](docs/extraction-plan.md)
- [docs/getting-started.md](docs/getting-started.md)
- [docs/new-user-guide.md](docs/new-user-guide.md)
- [docs/framework-primitives.md](docs/framework-primitives.md)
- [docs/self-hosting.md](docs/self-hosting.md)
