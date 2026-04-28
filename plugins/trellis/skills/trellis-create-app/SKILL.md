---
name: "trellis-create-app"
description: "Scaffold a new Trellis app with the right optional lanes using the CLI JSON contract."
---

# Trellis Create App

Use this skill when a user needs to create a new Trellis app.

## Goal

Get the user to a scaffolded app as fast as possible.

## Command Contract

Prefer machine-readable init:

```bash
npm run ai-sdr -- init <target-dir> --name <app-name> --json
```

For the AI SDR recipe, add only the lanes the user actually wants:

```bash
npm run ai-sdr -- init <target-dir> --name <app-name> \
  --with-discovery \
  --with-deep-research \
  --with-enrichment \
  --with-crm \
  --with-email \
  --with-handoff \
  --json
```

## Lane Language

Present the flags as product terms:

- Live Discovery
- Deep Research
- Enrichment
- CRM Sync
- Outbound Email
- Slack Handoff

But execute them through flags.

## After Scaffold

Tell the user the next three steps only:

1. `cd <target-dir>`
2. `npm install`
3. `npm run doctor -- --json`

## Noob Rule

Do not ask the user to understand all providers before scaffolding.

The first win is:

> app exists, installs, and can be checked
