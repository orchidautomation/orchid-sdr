# Roadmap

The roadmap is no longer "make a generic framework more turnkey."

The roadmap is "ship the GTM agent stack that works."

## Phase 1: Public Path

- keep `trellis init` Cloudflare-first
- keep `trellis connect` business-provider-only
- keep docs focused on the Cloudflare-first product
- keep `examples/gtm-sdr` as the single public example
- make `doctor`, `smoke`, and `deploy` the setup spine

## Phase 2: Runtime Parity

Port the existing AI SDR behavior into `@trellis/gtm`:

- normalized signal ingest
- qualification
- research brief
- outbound drafting
- approval gates
- CRM sync intent
- email send/reply intent
- handoff intent
- dashboard and MCP inspection

## Phase 3: Real Cloudflare Backing

- D1 migrations for runtime state
- R2 upload and mount for knowledge/skill packs
- Queue projection for workflow events
- Workflows for long waits and retries
- Durable Object / Cloudflare Agent identity
- AI Gateway routing metadata
- sandbox or browser execution only where needed

## Phase 4: Provider Execution

- Attio side effects behind approvals
- AgentMail side effects behind approvals
- Firecrawl research adapter
- optional Langfuse export
- provider readiness and smoke checks

## Phase 5: Product Finish

- generated dashboard that explains runtime state
- approval approve/reject actions
- MCP tools for safe operation
- deploy verification against a real Cloudflare account
- example GTM packs that feel demo-ready

## Non-Goal

Do not revive provider-composition as the product story. Provider abstraction is useful internally; the user-facing product is the working GTM agent stack.
