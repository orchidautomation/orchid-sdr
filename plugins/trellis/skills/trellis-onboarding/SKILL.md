---
name: "trellis-onboarding"
description: "Route a new Trellis user through the next correct setup workflow with minimal friction."
---

# Trellis Onboarding

Use this skill when a user is new to Trellis and needs guided setup.

## Core Rule

Do not try to explain or execute the whole platform in one skill.

Route the user into the smallest next workflow:

1. app creation
2. readiness diagnosis
3. provider connection
4. MCP install
5. first deploy
6. stack explanation

## Mental Model

Say this plainly:

- Trellis is the framework
- the app config is the blueprint
- knowledge is context
- skills are behavior
- providers do the real work

## Routing

If the user needs a new app:
- use `trellis-create-app`

If the app exists and they want to know what is missing:
- use `trellis-readiness-check`

If they need to wire vendors:
- use `trellis-connect-providers`

If they need Claude Code or Codex access:
- use `trellis-install-mcp`

If they want to ship:
- use `trellis-first-deploy`

If they ask “what is in this app?”:
- use `trellis-stack-explainer`

## Noob Rule

- one decision at a time
- one command at a time
- one blocker at a time

Prefer:

- `Next run this`
- `Blocked on this`
- `Here is the smallest next step`

Avoid:

- long architecture dumps
- provider walls
- raw schema language unless needed
