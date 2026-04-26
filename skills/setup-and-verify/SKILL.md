# Trellis Setup And Verify

Use this skill when you need to get a freshly scaffolded Trellis app running without guessing through the setup.

## Goal

Take a new Trellis project from scaffolded files to a verified local boot with the operator surface working.

## Required Sequence

1. Read `TRELLIS_SETUP.md` first.
2. Read `.env.example` and identify the required env values.
3. Confirm the selected profile in `ai-sdr.config.ts`.
4. Use `README.md` to understand whether this scaffold is `core`, `starter`, or `production`.
5. Fill only the minimum required env values first.
6. Run:
   - `npm install`
   - `npm run typecheck`
   - `npm test`
   - `npm run doctor`
7. Start the app with `npm run dev`.
8. Verify:
   - `GET /healthz`
   - `GET /dashboard`
   - dashboard flags resolve
9. Keep `NO_SENDS_MODE=true` until the runtime is healthy.

If setup work becomes provider-specific, switch to:

- `skills/convex-setup`
- `skills/vercel-setup`

## What To Check First

- `CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_URL` when browser/live clients are expected
- `ORCHID_SDR_SANDBOX_TOKEN`
- `HANDOFF_WEBHOOK_SECRET`
- `APP_URL`

## Safe First Actions

- use normalized signal ingest before live discovery
- use `npm run ai-sdr -- check` to confirm composition
- use `npm run sandbox:probe` only after the dashboard and health checks are green
- do not enable outbound providers until doctor checks are clean

## When Optional Providers Are Present

If the config includes optional providers, add them in this order:

1. research providers
2. discovery providers
3. enrichment providers
4. CRM / handoff
5. email / outbound

That keeps the first boot failure surface small.

## Failure Rules

- if the dashboard or healthz fails, stop and fix core runtime first
- if `doctor` is red, do not proceed to discovery or outbound
- if provider env is missing, disable that provider in config or finish the env before continuing
