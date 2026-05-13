# Agent-Native Architecture

The architecture is Cloudflare-first and Trellis-first.

Trellis should feel like one GTM agent product surface. Flue and Cloudflare are implementation details behind the happy path.

## Default Stack

```text
Trellis API        -> GTM product contract
Flue               -> agent harness and sessions
Cloudflare Workers -> HTTP entrypoint
Cloudflare Agents  -> durable agent identity
Durable Objects    -> per-agent locality and state
D1                 -> queryable app state
R2                 -> markdown packs, skills, files, artifacts
Queues             -> background work and retries
Workflows          -> long-running GTM processes
AI Gateway         -> model routing, visibility, and controls
Sandbox            -> heavy execution only when needed
MCP                -> operator and agent tool surface
```

## Rule

Cloudflare makes the platform reliable. Trellis makes it understandable for GTM builders.

Do not ask users to compose the state plane, actor runtime, model gateway, sandbox provider, queue system, and observability stack. Ship the stack that works.

## Lifecycle

```text
1. Signal reaches /webhooks/signals.
2. Trellis normalizes and stores it.
3. The agent receives only the relevant context.
4. A skill returns a typed qualification.
5. Trellis creates or updates the prospect.
6. Side-effecting work becomes a draft.
7. Drafts requiring email or CRM mutation create approvals.
8. Workflow starts or resumes.
9. Audit events and dashboard/MCP snapshots expose the state.
```

## Compute Strategy

Use the lightest execution surface that does the job.

- Markdown and repo context: R2 plus filesystem-style search.
- Large local context: just-bash-style grep/glob/read/jq.
- Web research: Firecrawl or browser tools.
- Heavy code, Python, browser, or process work: Cloudflare Sandbox.

Most GTM agents should not need a full sandbox for every step.

## Provider Strategy

Provider choices are business-level:

- CRM
- email
- research
- observability

They are not infrastructure-level:

- state
- queue
- actor runtime
- object store
- model gateway

The infrastructure stack is Trellis-owned unless a customer has a specific enterprise constraint.
