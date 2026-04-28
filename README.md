# Trellis

Trellis is a composable agentic GTM framework.

This repo now has two distinct layers:

- `packages/`
  - framework, provider modules, CLI, and MCP packaging
- `examples/ai-sdr/`
  - the reference AI SDR app built on top of Trellis
- `plugins/trellis/`
  - the Trellis Pluxx onboarding plugin, kept separate from the reference app

## Repo Shape

```text
packages/           framework + modules + CLI
examples/ai-sdr/    reference GTM agent app
plugins/trellis/    Trellis onboarding plugin for Claude/Cursor/Codex/OpenCode
docs/               framework and platform docs
gtm/                positioning and launch docs
```

## What Lives In `examples/ai-sdr`

The reference app includes:

- `ai-sdr.config.ts`
- `src/`
- `scripts/`
- `tests/`
- `convex/`
- `knowledge/`
- app-level `skills/`

That app is the current example of how to compose:

- state
- discovery
- research
- enrichment
- outbound
- CRM sync
- handoff
- MCP control

## Common Commands

Run these from the repo root:

```bash
npm run dev
npm run doctor
npm run typecheck
npm test
npm run ai-sdr -- modules --json
npm run ai-sdr -- check --json
```

## Scaffold A New App

```bash
npm run ai-sdr -- init ../my-trellis-agent --name my-trellis-agent --json
```

For the current reference AI SDR shape:

```bash
npm run ai-sdr -- init ../my-ai-sdr \
  --name my-ai-sdr \
  --with-discovery \
  --with-deep-research \
  --with-enrichment \
  --with-crm \
  --with-email \
  --with-handoff \
  --json
```

## Onboarding Direction

The CLI is the machine contract.

The guided user experience should come from the Trellis Pluxx plugin, not from an interactive terminal wizard.

Plugin source:

- [plugins/trellis/README.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/plugins/trellis/README.md)

## Reference App

Start here:

- [examples/ai-sdr/README.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/README.md)
