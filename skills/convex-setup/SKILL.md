# Trellis Convex Setup

Use this skill when a Trellis project needs Convex configured for local boot or deployment.

## Goal

Take a Trellis app from “Convex not configured” to “Convex state plane is healthy and the app can boot”.

## What Convex Is Responsible For In Trellis

- operational state plane
- workflow checkpoints
- prospects, threads, messages, provider runs
- dashboard-backed state

Convex is the default system of record for the reference app.

## Required Inputs

At minimum, make sure the project has:

- `CONVEX_URL`
- `NEXT_PUBLIC_CONVEX_URL`

Sometimes also needed:

- `CONVEX_DEPLOYMENT`
- `CONVEX_DEPLOY_KEY`
- `CONVEX_SITE_URL`

## Setup Sequence

1. Read `TRELLIS_SETUP.md`.
2. Inspect `.env.example` and `.env`.
3. Confirm the Trellis app is expecting Convex:
   - `ai-sdr.config.ts`
   - selected modules include `convex`
4. If local development is the goal:
   - run `npx convex dev`
   - or use an existing deployment URL
5. Make sure:
   - `CONVEX_URL` is valid for the Node runtime
   - `NEXT_PUBLIC_CONVEX_URL` matches the browser-facing deployment URL
6. Run:
   - `npm run typecheck`
   - `npm test`
   - `npm run doctor`
7. Boot the app with `npm run dev`
8. Verify:
   - `/healthz`
   - `/dashboard`

## What To Check

- if the app boots but dashboard state is empty, confirm `CONVEX_URL`
- if browser/live-query clients are involved, confirm `NEXT_PUBLIC_CONVEX_URL`
- if CI or non-interactive deploys are involved, confirm `CONVEX_DEPLOY_KEY`

## Notes From Official Convex Docs

- local development does not require a deploy key if you are using interactive CLI login or anonymous local development
- `CONVEX_DEPLOY_KEY` is mainly for CI/non-interactive deploys
- Convex provides `CONVEX_CLOUD_URL` and `CONVEX_SITE_URL` inside its own function environment

## Failure Rules

- if `npm run doctor` fails on Convex config, do not proceed to discovery or outbound setup
- do not treat Convex as optional for the default Trellis path
