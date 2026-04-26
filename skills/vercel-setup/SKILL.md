# Trellis Vercel Setup

Use this skill when a Trellis project needs Vercel configured for Sandbox auth, AI Gateway, or deployment.

## Goal

Take a Trellis app from “Vercel-related envs are missing or unclear” to “Sandbox turns, AI Gateway, and deployment URL assumptions are correct”.

## What Vercel Is Responsible For In Trellis

- Sandbox execution
- AI Gateway model routing
- optional hosted deployment target
- `VERCEL_URL` fallback for deployed app origin

## Required Inputs

For Sandbox auth, one of these paths is needed:

- `VERCEL_OIDC_TOKEN`
- or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`

For AI Gateway:

- `AI_GATEWAY_API_KEY`
- or `VERCEL_AI_GATEWAY_KEY`

For deployment:

- explicit `APP_URL` is preferred
- if the app is deployed on Vercel and `APP_URL` is unset, Trellis falls back to `https://$VERCEL_URL`

## Setup Sequence

1. Read `TRELLIS_SETUP.md`.
2. Inspect `.env.example` and `.env`.
3. Confirm `vercel-sandbox` and `vercel-ai-gateway` are selected in `ai-sdr.config.ts`.
4. Configure Sandbox auth first.
5. Configure AI Gateway auth second.
6. Confirm `APP_URL` is correct for the environment:
   - local: `http://localhost:3000`
   - deployed: explicit HTTPS origin
7. Run:
   - `npm run doctor`
   - `npm run sandbox:probe`
8. Verify:
   - dashboard is healthy
   - sandbox probe succeeds
   - MCP URL is derived correctly from `APP_URL`

## URL Rules

- local MCP URL: `http://localhost:3000/mcp/orchid-sdr`
- deployed MCP URL: `${APP_URL}/mcp/orchid-sdr`
- webhook URLs: `${APP_URL}/webhooks/...`

## Important Product Rule

Trellis does **not** currently depend on Vercel OAuth for dashboard or MCP login.

Current auth model:

- dashboard password: `DASHBOARD_PASSWORD`
- MCP bearer token: `ORCHID_SDR_MCP_TOKEN`
- both can fall back to `ORCHID_SDR_SANDBOX_TOKEN`

That keeps the app self-hostable instead of Vercel-locked.

## Notes From Official Vercel Docs

- Vercel environment variables only apply to new deployments after changes; redeploy after env updates
- `VERCEL_URL` is a system environment variable when system env exposure is enabled
- explicit `APP_URL` is still cleaner than relying on implicit deployment URL behavior

## Failure Rules

- if sandbox auth is not correct, stop before trying discovery or outbound
- if `APP_URL` is wrong, fix it before testing MCP or webhooks
