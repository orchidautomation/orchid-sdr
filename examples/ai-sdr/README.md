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

To scaffold a new reference app from this repo:

```bash
npm run ai-sdr -- init ../trellis-core --name trellis-core
```

Add providers incrementally as needed:

```bash
npm run ai-sdr -- add source apify --apply
npm run ai-sdr -- add deep-research parallel --apply
npm run ai-sdr -- add enrichment prospeo --apply
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

For a fuller runtime, add provider keys such as Convex, Apify, Parallel, Firecrawl, Vercel AI Gateway, AgentMail, and Attio. Neon remains optional as a SQL compatibility module and is not part of the default boot path.

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
npm run ai-sdr -- mcp claude-code --local --write
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
- [Framework Primitives](../../docs/framework-primitives.md)
- [CRM Normalization](../../docs/crm-normalization.md)
- [Self-Hosting](../../docs/self-hosting.md)
- [Email Providers](../../docs/email-providers.md)

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
