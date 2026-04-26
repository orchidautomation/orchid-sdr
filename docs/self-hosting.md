# Self-Hosting Orchid SDR

This guide is for a company that wants to clone the repo and run its own Orchid SDR control plane.

It assumes one deployment owns one product knowledge pack. Multiple campaigns can run inside one deployment, but if the underlying product or ICP is different, use a separate deployment or fork until product-specific knowledge is first-class.

## Deployment Modes

Use one of these modes first:

- **Safe pilot**
  `NO_SENDS_MODE=true`. The system can ingest, research, qualify, preview, sync CRM, and expose MCP state, but outbound sends are blocked.

- **Operator-approved outbound**
  Keep `NO_SENDS_MODE=true` while reviewing the first batch. Temporarily disable it only for approved sends through MCP or the operator console.

- **Autonomous outbound**
  Do not use this for a new customer until their source, qualification, copy, reply handling, unsubscribe handling, and CRM sync have been tested with real examples.

## Prerequisites

Required:

- Node.js 22 or Docker
- Convex deployment details
- a public HTTPS URL for production
- a long random `ORCHID_SDR_SANDBOX_TOKEN`
- a long random `ORCHID_SDR_MCP_TOKEN`
- a long random `HANDOFF_WEBHOOK_SECRET`

Usually required for the full agent lane:

- Vercel AI Gateway key
- Vercel Sandbox credentials
- Convex deployment details for the future default reactive state plane
- Apify token and a LinkedIn public-post task or actor
- Firecrawl key
- Parallel API key for authenticated research MCP and Task MCP

Optional:

- AgentMail for send/reply handling
- Attio for CRM sync
- Slack for handoff
- Prospeo for email enrichment
- Neon/Postgres only if you intentionally enable the optional SQL compatibility module

## 1. Clone And Configure

```bash
git clone <repo-url> orchid-sdr
cd orchid-sdr
cp .env.example .env
```

Edit `.env`.

Minimum safe-pilot values:

```bash
PORT=3000
APP_URL=https://sdr.example.com
CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NO_SENDS_MODE=true
DEFAULT_CAMPAIGN_TIMEZONE=America/New_York

ORCHID_SDR_SANDBOX_TOKEN=<long-random-secret>
ORCHID_SDR_MCP_TOKEN=<long-random-secret>
HANDOFF_WEBHOOK_SECRET=<long-random-secret>
DASHBOARD_PASSWORD=<long-random-password>
```

Important:

- `APP_URL` must be reachable from Vercel Sandboxes.
- `APP_URL` must be reachable from Apify and AgentMail if those webhooks are enabled.
- For Convex, set `CONVEX_URL` for the Node service and `NEXT_PUBLIC_CONVEX_URL` for future browser/live-query clients.
- Keep `NO_SENDS_MODE=true` until the customer has approved real sends.

## 2. Customize The Knowledge Pack

Before running a customer pilot, update:

- `knowledge/icp.md`
- `knowledge/product.md`
- `knowledge/usp.md`
- `knowledge/compliance.md`
- `knowledge/negative-signals.md`
- `knowledge/handoff.md`

Then review the tracked skills:

- `skills/icp-qualification`
- `skills/research-brief`
- `skills/research-checks`
- `skills/sdr-copy`
- `skills/reply-policy`
- `skills/handoff-policy`

The knowledge files are product facts. The skills are operating judgment. Both affect qualification and messaging.

## 3. Run With Docker Compose

Docker Compose is the most repeatable single-server path.

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

The app bootstraps the Convex-backed runtime on startup. To verify:

```bash
curl -fsS http://localhost:3000/healthz
```

Expected response:

```json
{"ok":true,"service":"orchid-sdr"}
```

Open:

```text
http://localhost:3000/dashboard
```

For production, put the app behind HTTPS with Caddy, Nginx, Traefik, a cloud load balancer, or the host platform's domain layer. Set `APP_URL` to that public HTTPS origin.

## 4. Run Without Docker

Use this path on a VM or PaaS that provides Node and can reach your configured Convex deployment and provider APIs.

```bash
npm install
npm run typecheck
npm test
npm run doctor
npm run build
npm start
```

`npm start` runs `dist/index.js`. The production process should be supervised by the host platform, `systemd`, PM2, Docker, or another process manager.

Health check:

```bash
curl -fsS http://localhost:3000/healthz
```

## 5. Configure Remote MCP Access

Add this to the MCP client that should operate the deployment:

```json
{
  "mcpServers": {
    "orchid-sdr": {
      "type": "http",
      "url": "https://sdr.example.com/mcp/orchid-sdr",
      "headers": {
        "Authorization": "Bearer ${ORCHID_SDR_MCP_TOKEN}"
      }
    }
  }
}
```

Verify with a read-only tool first:

```text
pipeline.summary
runtime.flags
runtime.discoveryHealth
knowledge.search
```

Do not test `mail.send` until `NO_SENDS_MODE` and the customer's sending policy are intentionally set.

## 6. Configure Discovery

For LinkedIn public-post discovery, set either a task ID or actor ID:

```bash
APIFY_TOKEN=<token>
APIFY_LINKEDIN_TASK_ID=<task-id>
# or
APIFY_LINKEDIN_ACTOR_ID=<actor-id>
DISCOVERY_LINKEDIN_ENABLED=true
DISCOVERY_LINKEDIN_SEED_TERMS=sales automation,revops,gtm engineering
```

Webhook endpoint:

```text
POST https://sdr.example.com/webhooks/apify?secret=<APIFY_WEBHOOK_SECRET>
```

Set:

```bash
APIFY_WEBHOOK_SECRET=<long-random-secret>
```

If you also want richer LinkedIn profile/company research during qualification and research-brief generation, point Trellis at a Harvest-style LinkedIn profile scraper task or actor:

```bash
APIFY_LINKEDIN_PROFILE_TASK_ID=<task-id>
# or
APIFY_LINKEDIN_PROFILE_ACTOR_ID=<actor-id>
```

The default input shape Trellis uses is:

```json
{
  "profileScraperMode": "Profile details no email ($4 per 1k)",
  "queries": ["https://www.linkedin.com/in/example/"]
}
```

For generic warm leads or custom sources, post normalized signals to:

```text
POST https://sdr.example.com/webhooks/signals?secret=<SIGNAL_WEBHOOK_SECRET>
```

Example payload:

```json
{
  "provider": "hubspot",
  "source": "warm_form",
  "externalId": "form-submission-123",
  "signals": [
    {
      "url": "https://example.com/forms/demo",
      "authorName": "Jane Doe",
      "authorTitle": "VP Marketing",
      "authorCompany": "Northstar",
      "companyDomain": "northstar.ai",
      "topic": "demo request",
      "content": "Interested in automating account research and outbound workflows."
    }
  ]
}
```

## 7. Configure Email And Replies

Keep this off for the first customer run unless there is an explicit send test.

```bash
AGENTMAIL_API_KEY=<key>
AGENTMAIL_WEBHOOK_SECRET=<svix-secret>
AGENTMAIL_AUTO_PROVISION_INBOX=false
AGENTMAIL_DEFAULT_SENDER_NAME="Customer SDR"
AGENTMAIL_DEFAULT_INBOX_DOMAIN=mail.customer-domain.com
```

AgentMail webhook endpoint:

```text
POST https://sdr.example.com/webhooks/agentmail
```

Before live sending, prove:

- sender inbox is correct
- reply webhook reaches the app
- unsubscribe handling pauses the thread
- bounce handling pauses the thread
- positive replies route to handoff or CRM correctly

## 8. Configure CRM Sync

For Attio:

```bash
ATTIO_API_KEY=<key>
ATTIO_DEFAULT_LIST_ID=<list-id>
ATTIO_DEFAULT_LIST_STAGE=Prospecting
ATTIO_AUTO_OUTBOUND_STAGE=Prospecting
ATTIO_AUTO_POSITIVE_REPLY_STAGE=Qualification
ATTIO_AUTO_NEGATIVE_REPLY_STAGE=Paused
```

Test with one reviewed prospect through:

```text
crm.syncProspect
```

Verify the company, person, list entry, notes, and stored Attio IDs before enabling automatic sync behavior.

## 9. First Customer Smoke Test

Run this in safe-pilot mode.

1. Confirm `/healthz` is green.
2. Run `npm run doctor` and review any warnings.
3. Open `/dashboard`.
4. Call `runtime.flags` through MCP and confirm `no_sends_mode` is enabled.
5. Call `knowledge.search` for a known ICP phrase.
6. Post one normalized test signal to `/webhooks/signals`.
7. Confirm the signal, prospect, thread, research brief, and audit events appear.
8. Call `lead.inspect` on the created prospect.
9. Generate a preview, but do not send.
10. Review the qualification and copy with the customer.
11. Only then decide whether to run a controlled send.

## Production Readiness Checklist

Before telling a customer this is production-ready, verify:

- deployment has a public HTTPS `APP_URL`
- database backups are enabled
- dashboard has a password
- MCP token is unique and stored as a secret
- webhook secrets are unique and stored as secrets
- `NO_SENDS_MODE=true` for first run
- knowledge pack is customized for the customer's product
- discovery source has produced at least one real signal
- generic signal webhook has been tested if using warm leads
- reply webhook has been tested with real provider payloads
- unsubscribe, bounce, wrong-person, referral, objection, and positive replies have been reviewed
- CRM sync has been tested on one real prospect
- blocked-send reasons are visible to the operator
- the customer has approved the first outbound batch

## Known Constraints

- HubSpot form ingestion should use `/webhooks/signals` today; a first-class HubSpot adapter is not built yet.
- X/Twitter discovery exists as a disabled source and should be treated as not ready until configured and tested.
- Product-fit routing across multiple products is a future idea, not part of the current production path.
- `mail.preview` can still be slower than ideal because it uses the sandbox drafting lane.
- Do not promise autonomous outbound until the customer's reply handling, compliance rules, and CRM workflow have been proven with real examples.
