# Trellis AI SDR Example

This directory contains the reference AI SDR built with Trellis.

It is not the framework itself. It is one example of what Trellis can compose when you combine:

- signals
- research
- qualification
- state
- skills
- MCP control
- optional CRM and outbound lanes

The example skill pack is runtime-only. Setup and deployment guidance lives in the repo docs and generated setup checklists, not in `examples/ai-sdr/skills/`.

## Why This Example Exists

AI SDR is the first reference workflow because it exercises the full Trellis shape:

```text
signal -> research -> qualify -> persist -> inspect -> sync -> send -> handoff
```

If that path is composable and reliable, the same framework can power other GTM systems too.

## Read This First

If you are trying to understand what is framework vs what is app code, read these in order:

1. [../../README.md](../../README.md)
2. [../../docs/ownership-model.md](../../docs/ownership-model.md)
3. [../../docs/turnkey-roadmap.md](../../docs/turnkey-roadmap.md)
4. [../../docs/ai-sdr-go-live.md](../../docs/ai-sdr-go-live.md)
5. [../../docs/extraction-plan.md](../../docs/extraction-plan.md)
6. [ai-sdr.config.ts](ai-sdr.config.ts)
7. [src/registry.ts](src/registry.ts)
8. [src/orchestration/prospect-workflow.ts](src/orchestration/prospect-workflow.ts)
9. [convex/schema.ts](convex/schema.ts)

That is the shortest path to understanding:

- what Trellis already gives you
- what this example composes
- what is still too custom today

## Fastest Demo Path

If your goal is one credible demo with the least confusion, use this order:

1. fill `.env` for the current reference app
2. keep `NO_SENDS_MODE=true`
3. run `npm run doctor`
4. deploy the app
5. verify `/healthz` and `/dashboard`
6. connect remote MCP to `${APP_URL}/mcp/trellis`
7. ingest one signal through `/webhooks/signals` or `/webhooks/apify`
8. inspect the resulting thread in the dashboard and through MCP

Concrete commands:

```bash
nvm use 22
npx convex dev
npm run trellis:demo:smoke
npm run trellis:demo:check
```

For real local development against Convex, keep `npx convex dev` running in one terminal and `npm run dev` in another. Use `TRELLIS_LOCAL_SMOKE_MODE=true` only when you want the in-memory local fallback instead of the Convex-backed runtime.

- `trellis:demo:smoke`
  - local safe end-to-end verification
  - checks `/healthz`, dashboard auth/state, `/mcp/trellis`, and one safe `/webhooks/signals` ingest
  - keeps `NO_SENDS_MODE=true`, so the demo stops safely without outbound
- `trellis:demo:check`
  - checks a running local or deployed app
  - verifies `/healthz`
  - logs into `/dashboard`
  - probes `/mcp/trellis` with bearer auth
  - posts one signal to `/webhooks/signals`

  - confirms dashboard state reflects the ingest when the downstream workflow is configured

Use these docs in sequence:

1. [../../docs/getting-started.md](../../docs/getting-started.md)
2. [../../docs/ai-sdr-go-live.md](../../docs/ai-sdr-go-live.md)
3. [../../docs/new-user-guide.md](../../docs/new-user-guide.md)

## What It Does

- runs scheduled discovery with Rivet actors
- ingests signals from Apify or any normalized webhook source
- researches the source post, person, company, and company news
- qualifies leads against the repo knowledge pack
- writes the workflow audit trail to Convex
- exposes the system through a dashboard and remote MCP server
- enforces quiet hours in each campaign's local IANA timezone
- can sync outbound accounts into Attio and update CRM stages on replies
- can optionally send and reply through AgentMail

## What Problem It Solves

Most "AI SDR" systems either:

- lock you into one opaque workflow
- or leave you stitching together too many brittle tools by hand

This example shows a different approach:

- explicit workflow stages
- typed provider surfaces
- repo-managed knowledge and skills
- remote MCP control
- durable state and audit history

## Anatomy

This example currently has three kinds of code in it:

### 1. App blueprint

- `ai-sdr.config.ts`

This is the compositional layer:

- knowledge
- skills
- modules
- providers
- bindings
- campaigns
- webhooks
- model routing

### 2. Runtime app code

- `src/orchestration/`
- `src/services/`
- `src/server.ts`
- `src/mcp/`
- `src/registry.ts`

This is the current working implementation of the AI SDR behavior.

### 3. State and storage code

- `convex/schema.ts`
- `convex/repository.ts`
- `packages/default-sdr/`
- `packages/convex/`

This is the substrate Trellis now owns by default for the reference SDR shape.

The extraction is already underway:

- `packages/convex/`
  - default Convex schema and state mutations
- `packages/default-sdr/`
  - default SDR domain types
  - repository contracts
  - Convex HTTP repository client
  - local smoke repository
  - actor registry
  - webhook bootstrap
  - MCP bootstrap
  - dashboard shell and dashboard cache helpers

That is the important nuance:

> the app is already strongly composed, and Trellis now owns most of the default SDR substrate underneath it

## Data Flow

```text
                           +----------------------+
                           |  knowledge/icp.md    |
                           |  product.md / usp.md |
                           |  repo skills/        |
                           +----------+-----------+
                                      |
                                      v
                    +--------------------------------------+
                    |  discoveryCoordinator (Rivet actor)  |
                    |  wakes on a schedule                 |
                    +----------------+---------------------+
                                     |
                                     | picks search terms
                                     v
                           +----------------------+
                           |  Apify or other      |
                           |  source systems      |
                           +----------+-----------+
                                      |
                                      | webhook payload
                                      v
                +------------------------------------------------+
                | /webhooks/apify or /webhooks/signals           |
                +----------------------+-------------------------+
                                       |
                                       v
                         +----------------------------+
                         | sourceIngest (Rivet actor) |
                         | normalize + persist signal |
                         +-------------+--------------+
                                       |
                                       v
                         +-----------------------------+
                         | prospectThread (Rivet actor)|
                         | one workflow per prospect   |
                         +-------------+---------------+
                                       |
                                       | research
                                       v
                     +-------------------------------------------+
                     | Firecrawl + sandbox-agent on Vercel      |
                     | post + profile + company + news          |
                     +------------------+------------------------+
                                        |
                                        | qualification + drafting
                                        v
                           +-----------------------------+
                           | Convex state plane         |
                           | signals / prospects /      |
                           | threads / briefs / messages|
                           +------+----------------------+
                                  |
                +-----------------+------------------+
                |                                    |
                v                                    v
        +---------------+                    +------------------+
        | Dashboard     |                    | MCP server       |
        | /dashboard    |                    | /mcp/trellis     |
        +---------------+                    +------------------+
                                  |
                                  | optional
                                  v
                        +-----------------------+
                        | AgentMail / Attio     |
                        | send, replies, CRM    |
                        +-----------------------+
```

## Core Surfaces

- `GET /dashboard`
  Operator console for pipeline state, actor health, sandbox jobs, provider runs, and qualified leads.
- `POST|GET|DELETE /mcp/trellis`
  Remote MCP server for querying and controlling the system from a local agent.
- `POST /webhooks/apify`
  Discovery ingest for Apify run completions.
- `POST /webhooks/signals`
  Generic ingest for normalized signals from any source.
- `POST /webhooks/agentmail`
  Inbound email wake-up path.
- `GET /healthz`
  Liveness check.

## Run It

The shortest safe local path is:

```bash
npm install
cp .env.example .env
npm run doctor
npm run dev
```

Minimum values for a real runtime:

- `APP_URL`
- `CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_URL`
- `TRELLIS_SANDBOX_TOKEN`
- `HANDOFF_WEBHOOK_SECRET`
- `RIVET_ENDPOINT`
- `RIVET_TOKEN`
- `FIRECRAWL_API_KEY`
- `AI_GATEWAY_API_KEY` or `VERCEL_AI_GATEWAY_KEY`
- `NO_SENDS_MODE=true`

If you only need boot verification before wiring Convex, use smoke mode instead of guessing:

```bash
export TRELLIS_LOCAL_SMOKE_MODE=true
export TRELLIS_SANDBOX_TOKEN=local-sandbox-token
export HANDOFF_WEBHOOK_SECRET=local-handoff-secret
npm run doctor
npm run dev
```

Smoke mode is only for boot and dashboard checks. It is not a real workflow runtime.

To scaffold a new reference app from this repo:

```bash
npm run trellis -- init ../trellis-core --name trellis-core
```

Add providers incrementally as needed:

```bash
npm run trellis -- add source apify --apply
npm run trellis -- add deep-research parallel --apply
npm run trellis -- add enrichment prospeo --apply
```

For the current repo:

1. Install dependencies.

```bash
npm install
```

2. Copy environment values into `.env`.

Minimum values for a local boot:

- `CONVEX_URL`
- `HANDOFF_WEBHOOK_SECRET`
- `TRELLIS_SANDBOX_TOKEN`
- `NO_SENDS_MODE=true`

3. Start the app.

```bash
npm run dev
```

4. Open the operator console.

```text
http://localhost:3000/dashboard
```

For a fuller runtime, add provider keys such as Convex, Apify, Parallel, Firecrawl, Vercel AI Gateway, AgentMail, and Attio.

### Canonical Hosted Demo Order

Use this order for one live demo:

1. set core envs and keep `NO_SENDS_MODE=true`
2. deploy the app and verify `GET ${APP_URL}/healthz`
3. log into `${APP_URL}/dashboard`
4. connect remote MCP to `${APP_URL}/mcp/trellis`
5. send one known signal to `${APP_URL}/webhooks/signals`
6. confirm the same prospect state appears in:
   - dashboard
   - `pipeline.summary`
   - `knowledge.search` / `lead.*` tools as relevant
7. only then enable discovery or CRM/email lanes

### Auth And Runtime Notes

- dashboard login uses `DASHBOARD_PASSWORD`, or falls back to `TRELLIS_SANDBOX_TOKEN`
- remote MCP uses `TRELLIS_MCP_TOKEN`, or falls back to `TRELLIS_SANDBOX_TOKEN`
- deployed MCP URL is `${APP_URL}/mcp/trellis`
- if `APP_URL` is unset on Vercel, the app falls back to `https://$VERCEL_URL`
- campaign quiet hours are evaluated in the campaign's local timezone
- discovery runs once per hour on weekdays by default
- LinkedIn discovery fetches up to 50 posts per run by default

For Claude Code local MCP setup:

```bash
npm run trellis -- mcp claude-code --local --write
```

For guided setup across hosts, use the Trellis plugin:

- [Claude Code installer](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-claude-code.sh)
- [Cursor installer](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-cursor.sh)
- [Codex installer](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-codex.sh)
- [OpenCode installer](https://github.com/orchidautomation/trellis-plugin/releases/latest/download/install-opencode.sh)

## Extend It

One deployment can run multiple campaigns with different:

- ICP slices
- discovery sources
- sender identities
- outreach strategies
- timezones and quiet-hour windows

Keep a single deployed control plane when the campaigns share the same product and knowledge pack. Use separate deployments when the knowledge files or tracked skills differ materially.

### Project Layout

- `src/`
  API, actors, orchestration, adapters, MCP server, and dashboard.
- `ai-sdr.config.ts`
  App blueprint for knowledge, skills, modules, providers, and bindings.
- `knowledge/`
  Product context used by qualification, research, and drafting.
- `skills/`
  Runtime AI SDR behavior: qualification, research, copy, reply policy, and handoff policy.
- `scripts/`
  Operational commands such as `doctor`, `discovery-tick`, `migrate`, and probes.
- `convex/`
  State-plane schema and repository integration.
- `tests/`
  App-level verification.

## Deploy It

A minimum deployment typically includes:

- Convex
- Vercel Sandbox
- Vercel AI Gateway
- Firecrawl
- Rivet

Optional deployment modules:

- Apify for discovery
- Parallel for deep research
- Prospeo for enrichment
- AgentMail for outbound
- Attio for CRM sync
- Slack for handoff

For hosted deployment, set `APP_URL` explicitly, verify the webhook routes against the deployed hostname, and keep `NO_SENDS_MODE=true` until the workflow has been reviewed end to end.

## Remember The Boundary

- `Trellis` = framework
- `examples/ai-sdr` = reference app

This example matters because it proves the framework can drive a real GTM workflow, not because Trellis is limited to SDR.

## Read Next

- [New User Guide](../../docs/new-user-guide.md)
- [Reference](../../docs/reference.md)
- [Getting Started](../../docs/getting-started.md)
- [AI SDR Go-Live](../../docs/ai-sdr-go-live.md)
- [Extraction Plan](../../docs/extraction-plan.md)
- [Framework Primitives](../../docs/framework-primitives.md)
- [CRM Normalization](../../docs/crm-normalization.md)
- [Self-Hosting](../../docs/self-hosting.md)
- [Email Providers](../../docs/email-providers.md)

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
