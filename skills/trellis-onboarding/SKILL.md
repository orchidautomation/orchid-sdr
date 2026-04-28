---
name: "trellis-onboarding"
description: "Guide a new user from scaffold to deployed Trellis GTM agent using the Trellis CLI as a machine contract."
---

# Trellis Onboarding

Use this skill when a user wants the Trellis plugin to create, configure, verify, and ship a GTM agent with as little manual setup as possible.

## Product Positioning

Trellis is the framework.

The user is not onboarding into “an AI SDR product.” They are onboarding into a composable agentic GTM runtime that can power:

- AI SDR
- meeting prep
- account research
- customer success copilots
- expansion / renewal workflows
- competitor monitoring
- pipeline intelligence

The first reference recipe is AI SDR, but the plugin should always frame the outcome as “a Trellis GTM agent app.”

## Acceptance Test

The real success condition is:

> a noob who vibecoded this into existence can use the Trellis plugin to create and ship a GTM agent to production.

Everything in the flow should reduce friction against that bar.

## Source Of Truth

Treat the Trellis CLI as the execution contract. Prefer machine-readable commands:

- `npm run ai-sdr -- init <target-dir> ... --json`
- `npm run ai-sdr -- connect <capability> <provider> --json`
- `npm run ai-sdr -- deploy <target> --json`
- `npm run ai-sdr -- mcp claude-code --local|--remote --json`
- `npm run doctor -- --json`

Do not scrape pretty terminal output if JSON is available.

## First-Class User Journey

### 1. Create the app

Default to the simplest viable path:

```bash
npm run ai-sdr -- init ../my-trellis-agent --name my-trellis-agent --json
```

If the user wants the AI SDR recipe, add the lanes explicitly:

```bash
npm run ai-sdr -- init ../my-ai-sdr --name my-ai-sdr \
  --with-discovery \
  --with-deep-research \
  --with-enrichment \
  --with-crm \
  --with-email \
  --with-handoff \
  --json
```

The plugin should present lanes as product language:

- Live Discovery
- Deep Research
- Enrichment
- CRM Sync
- Outbound Email
- Slack Handoff

But execute them through explicit flags.

### 2. Diagnose readiness

Immediately run:

```bash
npm run doctor -- --json
```

Classify blockers into:

- boot blockers
- discovery blockers
- optional blockers

Show the user the minimum next action, not the full wall of env text.

### 3. Get the first proof fast

Before asking the user to wire every provider, prefer smoke-mode boot:

```bash
TRELLIS_LOCAL_SMOKE_MODE=true
ORCHID_SDR_SANDBOX_TOKEN=<local-dev-token>
HANDOFF_WEBHOOK_SECRET=<local-dev-secret>
DISCOVERY_LINKEDIN_ENABLED=false
```

Then:

```bash
npm run doctor
npm run dev
```

Success means:

- `/healthz` returns ok
- `/dashboard` loads
- the operator surface is reachable

### 4. Connect real providers

Add providers one lane at a time. Preferred order:

1. state / runtime
2. research
3. discovery
4. enrichment
5. CRM / handoff
6. outbound

Use:

```bash
npm run ai-sdr -- connect <capability> <provider> --json
```

Then write or verify env values and rerun doctor.

### 5. Install MCP

For Claude Code / Codex style hosts, set up MCP with:

```bash
npm run ai-sdr -- mcp claude-code --local --write --json
```

If deployed:

```bash
npm run ai-sdr -- mcp claude-code --remote --write --json
```

The plugin should explain:

- local MCP URL
- remote MCP URL
- bearer token source
- what file was written

### 6. Ship to production

Ask the user where they want to ship:

- local only
- Vercel-hosted app
- self-hosted app

Use:

```bash
npm run ai-sdr -- deploy <target> --json
```

Then walk them through only the missing pieces for that target.

## Official Platform Guidance To Respect

These rules come from the current docs and should shape the plugin flow.

### Convex

- Install CLI: `npm install convex`
- Local setup starts with: `npx convex dev`
- Production deploy: `npx convex deploy`
- `npx convex dev` creates:
  - `convex/`
  - `.env.local` with `CONVEX_DEPLOYMENT`
- For cloud coding agents, use Convex agent mode:
  - `CONVEX_AGENT_MODE=anonymous`
  - example: `CONVEX_AGENT_MODE=anonymous npx convex dev`
- Treat `CONVEX_DEPLOY_KEY` as the CI / non-interactive deploy path

### Vercel

- Simplest deploy path:
  - install CLI
  - `vercel login`
  - run `vercel`
  - run `vercel --prod` for production
- If the repo is connected in Vercel, every push triggers a deployment
- For AI Gateway / coding-agent flows:
  - link the project
  - pull envs when relevant
  - verify credentials before assuming model routing is healthy

### Rivet

- Rivet is the durable/stateful actor runtime layer
- Common production command:
  - `rivet deploy`
  - or `rivet deploy --environment prod`
- For RivetKit actor projects, deployment may also use:
  - `npx rivet-cli@latest deploy`
- Keep Rivet guidance focused on:
  - actor runtime
  - environment selection
  - logs
  - deployment verification

## Firecrawl Rule

When the plugin needs current setup truth for a provider or platform:

1. use Firecrawl `map` to find the exact doc page
2. use Firecrawl `scrape` to extract the specific commands or env vars
3. prefer official docs over blog posts or memory

Do not hardcode fragile setup advice if the official doc can be checked quickly.

## Interaction Rules

- optimize for the minimum number of decisions
- ask for one thing at a time
- never dump the entire stack setup at once
- default to the fastest path that proves progress
- keep `NO_SENDS_MODE=true` until the app is healthy
- do not push the user into live outbound before doctor is clean
- treat smoke mode as a boot proof, not as full production proof

## Failure Handling

If something is missing:

- tell the user exactly what is blocking the next step
- show the exact command or env var needed
- rerun the relevant JSON command
- continue from the current state instead of restarting the whole flow

If deployment works but the runtime is unhealthy:

- stop
- verify healthz
- verify dashboard
- verify MCP
- only then move to discovery and outbound

## Recommended Happy Path

For a first-time AI SDR builder, the plugin should generally drive:

1. scaffold AI SDR recipe
2. smoke boot locally
3. set up Convex
4. set up Vercel / AI Gateway if selected
5. set up MCP
6. connect discovery / research / enrichment
7. deploy
8. run one real signal through the workflow

That is the onboarding arc to optimize for.
