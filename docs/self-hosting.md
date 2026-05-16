# Self-Hosting Trellis

For current Trellis, "self-hosting" means you own the deploy account and Trellis deploys into it. It does not mean assembling a custom Convex/Vercel/Rivet stack.

## Prerequisites

- Node.js 22
- npm
- deploy account access
- either `npm run cf:login` in the generated app or `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN`

Business provider keys are optional for first deploy.

## Create The App

```bash
npm run trellis -- init ../acme-sdr --name acme-sdr
cd ../acme-sdr
npm install
```

## Configure The Deploy Target

The scaffold expects bindings for managed app state, packs and artifacts, queues, and durable agent identity.
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
npm run trellis -- connect mail
npm run trellis -- connect research
```

Then add provider secrets to the deploy environment.

Keep no-send mode enabled until real customer examples have been reviewed.
