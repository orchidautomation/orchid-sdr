---
name: "trellis-install-mcp"
description: "Set up Trellis MCP access for Claude Code or similar coding hosts."
---

# Trellis Install MCP

Use this skill when the user wants Trellis available inside Claude Code, Codex, or another MCP-capable host.

## Command Contract

For local development:

```bash
npm run ai-sdr -- mcp claude-code --local --write --json
```

For a deployed app:

```bash
npm run ai-sdr -- mcp claude-code --remote --write --json
```

## Explain Only What Matters

Tell the user:

- local MCP URL or remote MCP URL
- where the config was written
- which token is being used
- what to do next if auth or URL is missing

## Required Context

If remote:

- confirm `APP_URL`
- confirm `TRELLIS_MCP_TOKEN` or fallback token

If local:

- confirm the app is running
- confirm the local URL responds

## Noob Rule

Avoid deep MCP explanation.

Say:

- `This connects your coding agent to your Trellis app.`
- `Once written, restart or reload the host if needed.`
