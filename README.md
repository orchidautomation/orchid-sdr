# Orchid SDR

`orchid-sdr` is an agent-native outbound control plane.

It wakes up on a schedule, finds leads from public signals, researches the person and company, qualifies them against `knowledge/icp.md`, writes everything to Postgres, and can optionally draft, send, and track outreach.

## What It Does

- runs scheduled discovery with Rivet actors
- ingests signals from Apify or any normalized webhook source
- researches the source post, person, company, and company news
- qualifies leads against the repo knowledge pack
- writes the full audit trail to Postgres
- exposes the system through a dashboard and a remote MCP server
- can optionally sync qualified leads into Attio
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
                           | Postgres system of record   |
                           | signals / prospects /       |
                           | threads / briefs / messages |
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

1. Install dependencies.

```bash
npm install
```

2. Copy env values into `.env`.

At minimum you usually want:

- `DATABASE_URL`
- `HANDOFF_WEBHOOK_SECRET`
- `ORCHID_SDR_SANDBOX_TOKEN`
- `NO_SENDS_MODE=true`

3. Run migrations and start the app.

```bash
npm run db:migrate
npm run dev
```

4. Open the operator console.

```text
http://localhost:3000/dashboard
```

If you want the full runtime, add provider keys such as Apify, Firecrawl, Vercel AI Gateway, AgentMail, and Attio.

## Repo Layout

- `src/`
  API, actors, orchestration, adapters, MCP server, and dashboard.
- `knowledge/`
  Product context that feeds qualification, research, and drafting.
- `skills/`
  Sandbox skill instructions for qualification, research, copy, reply policy, and handoff policy.
- `docs/reference.md`
  Full setup, env, MCP, skill, knowledge-pack, Attio, and webhook details.
- `blog/`
  Long-form posts on the architecture, product thesis, and category.
- `docs/blog/`
  Blog and launch writing.

## Read Next

- [Reference](docs/reference.md)
- [Blog Series](blog/README.md)
- [The AI SDR Market Is Broken](docs/blog/the-ai-sdr-market-is-broken.md)
- [LinkedIn Post Draft](docs/blog/linkedin-post-built-an-ai-sdr-in-eight-hours.md)

## License

AGPL-3.0-only. See [LICENSE](LICENSE).
