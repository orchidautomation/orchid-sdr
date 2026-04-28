# Trellis Plugin

This folder contains the Trellis Pluxx plugin.

It is intentionally separate from [`examples/ai-sdr/`](../../examples/ai-sdr/) so the AI SDR reference app stays self-contained and the plugin can be split into its own repo with minimal surgery.

## What Lives Here

- `pluxx.config.ts`
- `package.json`
- `skills/`

The current plugin owns the guided onboarding layer for Trellis across:

- Claude Code
- Cursor
- Codex
- OpenCode

## Commands

Run these from this folder:

```bash
pluxx lint
pluxx validate
pluxx build --target claude-code cursor codex opencode
```

## Current Skills

- `trellis-onboarding`
- `trellis-create-app`
- `trellis-readiness-check`
- `trellis-connect-providers`
- `trellis-install-mcp`
- `trellis-stack-explainer`
- `trellis-first-deploy`

The top-level onboarding skill should stay thin. The workflow skills should do the real work.
