# Trellis

Trellis is a composable agentic GTM framework.

Developed by Orchid Labs.

This repo now has two distinct layers:

- `packages/`
  - framework, provider modules, CLI, and MCP packaging
- `examples/ai-sdr/`
  - the reference AI SDR app built on top of Trellis

## Repo Shape

```text
packages/           framework + modules + CLI
examples/ai-sdr/    reference GTM agent app
docs/               framework and platform docs
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

The guided user experience should sit on top of this repo, not inside an interactive terminal wizard in the CLI.

## Reference App

Start here:

- [examples/ai-sdr/README.md](examples/ai-sdr/README.md)
