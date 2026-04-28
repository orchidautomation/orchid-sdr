---
name: "trellis-first-deploy"
description: "Take a first-time Trellis user from local scaffold to the simplest production deployment path."
---

# Trellis First Deploy

Use this skill when the user wants the shortest credible path to get a Trellis GTM agent into production.

## Goal

Help a noob ship a working Trellis app without forcing them to understand the whole stack up front.

## Default Deploy Assumption

Prefer this order unless the user says otherwise:

1. smoke boot locally
2. set up Convex
3. set up Vercel
4. verify MCP
5. deploy

## Required Checks

Run:

```bash
npm run doctor -- --json
npm run ai-sdr -- deploy vercel --json
```

Then tell the user only the next missing step.

## Core Commands

### Convex

```bash
npx convex dev
npx convex deploy
```

For cloud coding agents:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

### Vercel

```bash
vercel login
vercel
vercel --prod
```

## Noob Rule

Do not say “configure your infrastructure.”

Say:

- `Next: run vercel login`
- `Next: run npx convex dev`
- `Next: set CONVEX_URL in .env`

## Success Condition

Production is only “done” when:

- deploy succeeds
- `/healthz` is healthy
- dashboard loads
- MCP endpoint is reachable
