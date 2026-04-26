# Orchid SDR

`orchid-sdr` is an agent-native outbound control plane.

It wakes up on a schedule, finds leads from public signals, researches the person and company, qualifies them against `knowledge/icp.md`, writes operational state to Convex, and can optionally draft, send, and track outreach.

## What It Does

- runs hourly weekday discovery with Rivet actors
- ingests signals from Apify or any normalized webhook source
- researches the source post, person, company, and company news
- qualifies leads against the repo knowledge pack
- writes the full audit trail to Convex
- exposes the system through a dashboard and a remote MCP server
- enforces quiet hours in the campaign's local IANA timezone
- can auto-sync outbound accounts into Attio and promote CRM stages on replies
- can optionally send and reply through AgentMail

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
        | /dashboard    |                    | /mcp/orchid-sdr  |
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
- `POST|GET|DELETE /mcp/orchid-sdr`
  Remote MCP server for querying and controlling the system from a local agent.
- `POST /webhooks/apify`
  Discovery ingest for Apify run completions.
- `POST /webhooks/signals`
  Generic ingest for normalized signals from any source.
- `POST /webhooks/agentmail`
  Inbound email wake-up path.
- `GET /healthz`
  Liveness check.

## Quick Start

If you want a new working reference app scaffold from this repo:

```bash
npm run ai-sdr -- init ../trellis-starter --profile starter --name trellis-starter
```

The generated project includes `TRELLIS_SETUP.md` with the exact first-boot checklist for that selected profile.

For the current repo itself:

1. Install dependencies.

```bash
npm install
```

2. Copy env values into `.env`.

At minimum you usually want:

- `CONVEX_URL`
- `HANDOFF_WEBHOOK_SECRET`
- `ORCHID_SDR_SANDBOX_TOKEN`
- `NO_SENDS_MODE=true`

3. Start the app.

```bash
npm run dev
```

4. Open the operator console.

```text
http://localhost:3000/dashboard
```

If you want the full runtime, add provider keys such as Convex, Apify, Parallel, Firecrawl, Vercel AI Gateway, AgentMail, and Attio. Neon remains available only as an optional SQL compatibility module, not part of the default boot path. When Attio is configured, the first outbound can auto-create or update the company and contact, and classified replies can automatically promote the Attio stage.

Campaign quiet hours are evaluated in the campaign's local timezone. New campaigns inherit `DEFAULT_CAMPAIGN_TIMEZONE` and you can update a live campaign later through the remote MCP tool `control.setCampaignTimezone`.

Parallel Search MCP is mounted into sandbox turns by default using `https://search.parallel.ai/mcp`. If you set `PARALLEL_API_KEY`, the sandbox adds bearer auth and also mounts Parallel Task MCP at `https://task-mcp.parallel.ai/mcp` for async deep research and enrichment.

By default, discovery runs once per hour on weekdays only, and LinkedIn discovery will fetch up to 50 posts per run.

## Multiple Campaigns

One deployment can run multiple campaigns.

That is the right model when you want multiple outbound agents for the same product, for example:

- different ICP slices
- different discovery sources
- different sender identities
- different outreach strategies
- different timezones and quiet-hour windows

In that setup, keep one deployed control plane and create multiple campaigns inside it.

Separate deploys are safer when the underlying product or knowledge pack is different, because the current `knowledge/` files and tracked `skills/` are still repo-global rather than campaign-scoped.

## Repo Layout

- `src/`
  API, actors, orchestration, adapters, MCP server, and dashboard.
- `ai-sdr.config.ts`
  Early typed framework config describing the current deployment as composable knowledge, skills, providers, and campaigns.
- `knowledge/`
  Product context that feeds qualification, research, and drafting.
- `skills/`
  Sandbox skill instructions for qualification, research, copy, reply policy, and handoff policy.
- `docs/reference.md`
  Full setup, env, MCP, skill, knowledge-pack, Attio, and webhook details.
- `docs/framework-primitives.md`
  Emerging modular primitives for GTM engineers building custom AI SDRs with coding agents.
- `docs/crm-normalization.md`
  Normalized CRM contracts for Salesforce, HubSpot, Twenty, Attio, and Nango-backed adapters.
- `docs/self-hosting.md`
  Clone-and-deploy guide for running Orchid SDR on a customer's own server.
- `docs/email-providers.md`
  Email provider guidance for agent-native outbound and why AgentMail is the default fit.
- `blog/`
  Long-form posts on the architecture, product thesis, and category.
- `docs/blog/`
  Blog and launch writing.
- `future-ideas/`
  Longer-horizon product and architecture ideas that are not part of the immediate production checklist.

## Read Next

- [Reference](docs/reference.md)
- [Getting Started](docs/getting-started.md)
- [Framework Primitives](docs/framework-primitives.md)
- [CRM Normalization](docs/crm-normalization.md)
- [Self-Hosting](docs/self-hosting.md)
- [Email Providers](docs/email-providers.md)
- [Blog Series](blog/README.md)
- [Future Ideas](future-ideas/README.md)
- [The AI SDR Market Is Broken](docs/blog/the-ai-sdr-market-is-broken.md)
- [LinkedIn Post Draft](docs/blog/linkedin-post-built-an-ai-sdr-in-eight-hours.md)

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
