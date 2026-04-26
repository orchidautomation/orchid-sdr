# Getting Started

This is the shortest path to a working Trellis reference app.

## 1. Scaffold

```bash
npm run ai-sdr -- init ../trellis-starter --profile starter --name trellis-starter
```

Profiles:

- `core` - minimum runtime
- `starter` - core plus discovery, deep research, and enrichment
- `production` - current production-parity reference stack

## 2. Install

```bash
cd ../trellis-starter
npm install
cp .env.example .env
```

## 3. Fill the minimum env

At minimum:

- `APP_URL`
- `CONVEX_URL`
- `ORCHID_SDR_SANDBOX_TOKEN`
- `HANDOFF_WEBHOOK_SECRET`
- `NO_SENDS_MODE=true`

If the selected profile includes additional providers, fill those after the core env is working.

## 4. Verify

```bash
npm run typecheck
npm test
npm run doctor
npm run dev
```

## 5. Open the operator surface

```text
http://localhost:3000/dashboard
```

## 6. Use the generated checklist

Every scaffolded project includes:

- `TRELLIS_SETUP.md`

That file is the profile-specific onboarding checklist. Start there before enabling discovery, CRM, or outbound email.

## 7. Stay safe on first boot

- keep `NO_SENDS_MODE=true`
- confirm `/healthz` returns 200
- confirm dashboard flags resolve
- ingest one normalized signal before enabling live discovery
