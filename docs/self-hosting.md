# Self-Hosting Trellis

For v3, "self-hosting" means you own the Cloudflare account and Trellis deploys into it. It does not mean assembling a custom Convex/Vercel/Rivet stack.

## Prerequisites

- Node.js 22
- npm
- Cloudflare account access
- either `npm run cf:login` in the generated app or `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN`

Business provider keys are optional for first deploy.

## Create The App

```bash
npm run trellis -- init ../acme-sdr --name acme-sdr
cd ../acme-sdr
npm install
```

## Configure Cloudflare

The scaffold expects Cloudflare bindings for:

- D1 app state
- R2 packs and artifacts
- Queues
- Durable Objects / Cloudflare Agents
- AI Gateway

Use the generated `wrangler.jsonc` as the source of truth, then run:

```bash
npm run trellis -- doctor
```

## Deploy

```bash
npm run trellis -- smoke
npm run trellis -- deploy
```

The deployed app should answer:

```text
GET /healthz
GET /smoke
GET /dashboard
POST /webhooks/signals
POST /mcp/trellis
```

## Connect Business Systems

After the app is live:

```bash
npm run trellis -- connect attio
npm run trellis -- connect agentmail
npm run trellis -- connect firecrawl
```

Then add provider secrets to Cloudflare.

Keep no-send mode enabled until real customer examples have been reviewed.

## Legacy Self-Hosting

The older Docker/Node self-hosting path is retained only for the existing reference app while v3 reaches parity. It is not the target architecture.
