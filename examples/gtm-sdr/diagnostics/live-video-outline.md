# Live Demo Video Outline

Use this for a short founder/product walkthrough.

## Core Frame

Trellis is an agent runtime for GTM workflows.

The point is not that an LLM can draft an email. The point is that a team can define a reliable agent with:

- skills as reusable methodology
- knowledge as company-specific context
- D1 state and traces as the audit trail
- approval gates before external side effects
- MCP surfaces for humans and other agents to inspect and operate the workflow

## One-Minute Opening

Say:

```text
I built Trellis because GTM teams do not just need prompts. They need reliable agents that can follow process, use company knowledge, keep state, expose approvals, and show exactly what happened.

This demo is a BDR agent. A form-fill signal comes in, Trellis qualifies it, researches the account, drafts copy, records every step, calculates cost, and blocks email or CRM writes until a human approves.
```

## Files To Show

Show these in order:

1. `inputs/demo-form-payload.json`
   - the incoming signal
   - explain that any webhook, form, workspace event, or API call can become a Trellis signal

2. `src/agent.ts`
   - the agent blueprint
   - show providers, model, state, MCP surfaces, knowledge, skills, and safety
   - point to the actual flow: qualification -> research -> copy -> workflow

3. `skills/icp-qualification/SKILL.md`
   - show that skills are reusable method files
   - emphasize that product-specific details are not hard-coded here

4. `knowledge/company.md`, `knowledge/icp.md`, `knowledge/messaging.md`
   - show where company-specific positioning and ICP live
   - frame this as the part a GTM team can edit without rewriting runtime code

5. `src/state/prospect.map.ts`
   - show how business state is defined
   - explain that Trellis owns D1 runtime schema, while the app defines queryable business projections

6. `outputs/pylon-live-run.md`
   - show the real D1-derived result: lead, state, draft, approvals, trace counts, and cost

## Claude Code Prompts

Use:

```text
Use trellis-sdr to describe this BDR agent.
```

```text
Use trellis-sdr to show current leads and pending approvals.
```

```text
Use trellis-sdr to get the Pylon lead.
```

```text
Use trellis-sdr to estimate the cost for the latest Pylon trace.
```

Then:

```text
Use trellis-operator to show runtime health and operator controls.
```

## CLI Moment

Say:

```text
The CLI is how you scaffold, verify, deploy, connect providers, and connect MCP clients. You do not need to hand-wire the runtime every time.
```

Show:

```bash
npm run doctor -- --json
npm run deploy -- --json
npm run verify -- --live --url "$APP_URL" --api-key "$TRELLIS_API_KEY"
npm run trellis -- connect attio --json
npm run trellis -- mcp claude-code --remote --write --json --url "$APP_URL/mcp/trellis" --token "$TRELLIS_API_KEY"
```

## What To Emphasize

- The skill files are generic process.
- The knowledge files make the agent specific to a company or motion.
- The sample payload is just one way to start a run.
- D1 gives queryable state, traces, drafts, approvals, and costs.
- MCP makes the same agent available in Claude Code, Cursor, Codex, and other clients.
- Operator surfaces sit over the same runtime; they are not separate agent brains.

## Close

Say:

```text
Trellis lets a team build an agent once, define its process and knowledge clearly, then operate it safely anywhere the team works. The demo is BDR, but the same pattern works for account research, customer success, support triage, implementation workflows, and internal ops.
```
