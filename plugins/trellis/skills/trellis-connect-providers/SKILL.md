---
name: "trellis-connect-providers"
description: "Wire Trellis providers one lane at a time with clear, minimal instructions."
---

# Trellis Connect Providers

Use this skill when a user needs to connect one or more providers.

## Order

Prefer this setup order unless the user has a stronger constraint:

1. state and runtime
2. research
3. discovery
4. enrichment
5. CRM and handoff
6. outbound

## Source Of Truth

Read:

1. `ai-sdr.config.ts`
2. `npm run ai-sdr -- modules --json`
3. `npm run ai-sdr -- check --json`
4. `npm run doctor -- --json`

## Command Contract

Use:

```bash
npm run ai-sdr -- connect <capability> <provider> --json
```

Then tell the user only:

- which env vars are still missing
- what command to run next
- what the provider actually does

## Plain-Language Mapping

- Convex = state
- Apify = discovery
- Firecrawl = web search and extraction
- Parallel = deep research
- Prospeo = enrichment
- Attio = CRM
- AgentMail = email
- Slack = handoff
- Rivet = runtime
- Vercel Sandbox = isolated agent execution
- Vercel AI Gateway = model routing

## Noob Rule

Never ask the user to set up six providers at once.

Finish one lane, rerun doctor, then move on.
