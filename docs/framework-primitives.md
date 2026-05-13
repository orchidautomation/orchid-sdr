# Trellis v3 Primitives

Trellis v3 should not expose "framework primitives" as a menu of interchangeable infrastructure pieces. The public primitives are GTM product objects.

## Product Primitives

```text
signal -> context -> skill -> qualification -> prospect -> draft -> approval -> workflow -> audit
```

These are the primitives Trellis users should understand.

## Signal

A normalized event that starts or updates GTM work.

Examples:

- form submission
- product signup
- LinkedIn post
- job post
- manual webhook
- CSV row
- reply event

## Context

The small, relevant bundle of facts the agent needs:

- signal payload
- CRM account or contact record
- product and ICP markdown
- recent research
- prior thread state
- policy constraints

## Skill

A tracked markdown instruction pack that performs one repeatable behavior:

- ICP qualification
- research sufficiency
- SDR copy
- reply classification
- handoff policy

## Qualification

A typed decision that can be validated, stored, and inspected.

## Prospect

The durable GTM object created from a signal and qualification.

## Draft

The proposed outbound or CRM mutation. Drafts are blocked by default when they would cause side effects.

## Approval

The explicit gate for unsafe actions such as:

- `email.send`
- `crm.update`
- `calendar.book`
- `workflow.escalate`

## Workflow

The durable GTM process:

- qualify
- research
- draft
- wait for approval
- send
- wait for reply
- follow up
- hand off

## Audit

Append-only proof of what happened and why.

## Hidden Infrastructure

The user should not need to choose these on day one:

- Flue harness
- Cloudflare Workers
- Cloudflare Agents / Durable Objects
- D1
- R2
- Queues
- Workflows
- AI Gateway
- Sandbox

Those are Trellis internals unless a deployment is being debugged or extended.
