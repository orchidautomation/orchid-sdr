---
name: "trellis-readiness-check"
description: "Diagnose what a Trellis app is missing and reduce it to the smallest next action."
---

# Trellis Readiness Check

Use this skill when the app already exists and the user needs to know what is blocking boot or deploy.

## Command Contract

Always start with:

```bash
npm run doctor -- --json
```

If useful, also read:

```bash
npm run ai-sdr -- check --json
npm run ai-sdr -- modules --json
```

## Classification

Reduce results into:

1. boot blockers
2. discovery blockers
3. optional blockers

## Output Rule

Do not dump the whole doctor payload back to the user.

Instead say:

- what is blocked
- why it matters
- the next command or env var to set

Example:

- `Blocked: Trellis cannot persist state until CONVEX_URL is set.`
- `Next: run npx convex dev and copy the URL into .env`

## Smoke First

If the user does not have the full vendor stack ready, prefer local smoke mode:

```bash
TRELLIS_LOCAL_SMOKE_MODE=true
TRELLIS_SANDBOX_TOKEN=<local-dev-token>
HANDOFF_WEBHOOK_SECRET=<local-dev-secret>
DISCOVERY_LINKEDIN_ENABLED=false
```

Then rerun doctor and boot the app.
