# Extraction Plan

This document is the practical brainstorm for reducing the remaining AI SDR-specific custom code and moving repeated infrastructure into Trellis.

It complements:

- [Ownership Model](ownership-model.md)
- [Turnkey Roadmap](turnkey-roadmap.md)

The difference is:

- `ownership-model.md` says who should own what
- `turnkey-roadmap.md` says the broad phases
- this document names the likely code moves

## Principle

When code is likely to repeat across multiple GTM apps, it should move into Trellis.

When code expresses app-specific judgment or domain behavior, it can remain in the app.

## Recommended Package Boundary

Not every extraction belongs in `@ai-sdr/framework`.

There are now two distinct kinds of reusable code:

1. generic Trellis primitives
2. default SDR substrate

The generic Trellis primitives belong in framework packages like:

- `@ai-sdr/framework`
- `@ai-sdr/convex`

The SDR-specific reusable substrate should likely converge into a dedicated package such as:

- `@ai-sdr/default-sdr`

That package would own:

- default SDR domain types
- default repository contracts
- default Convex repository client
- default smoke repository
- default actor topology
- default webhook and MCP bootstrap for the reference SDR app
- default dashboard shell and dashboard state caching helpers

This keeps the framework generic while still shipping a turnkey default SDR model.

## Current Extraction Status

Already moved into shared packages:

- `packages/convex/`
  - default Convex schema
  - generic state mutations
- `packages/default-sdr/`
  - default SDR domain types
  - repository contracts
  - Convex HTTP repository client
  - local smoke repository
  - provider binding resolution
  - default actor registry
  - default runtime bootstrap
  - default webhook bootstrap
  - default MCP server bootstrap
  - default operator/runtime MCP tool service
  - default dashboard shell
  - dashboard auth and cache helpers
  - dashboard state builders

Still primarily app-owned:

- `examples/ai-sdr/src/orchestration/discovery-coordinator.ts`
- `examples/ai-sdr/src/orchestration/prospect-workflow.ts`
- `examples/ai-sdr/src/server.ts`

Partially extracted but still mixed:

- `examples/ai-sdr/src/services/mcp-tools.ts`
  - operator/runtime/pipeline reads now belong to `packages/default-sdr/`
  - provider-heavy actions such as Attio sync, AgentMail send/reply, and custom handoff still belong to the AI SDR app or a future richer SDR package

- `examples/ai-sdr/src/services/runtime-context.ts`
  - app-specific adapters/services still assembled here
- `examples/ai-sdr/src/services/runtime-bootstrap.ts`
  - now mostly a thin wrapper over shared default SDR bootstrap
- `examples/ai-sdr/src/server.ts`
  - dashboard state builders now belong to `packages/default-sdr/`
  - route-level orchestration and auth wiring still live in the app

## Extraction Buckets

## 1. State substrate

Current custom surfaces:

- `examples/ai-sdr/convex/repository.ts`
- `examples/ai-sdr/src/repository.ts`

Extraction target:

- `@ai-sdr/convex` or broader Trellis state package

What should move:

- default GTM state schema
- repository interfaces
- default repository implementation
- smoke-mode repository implementation
- state-plane helpers

What should remain configurable:

- custom tables
- app-specific fields
- optional workflow-specific records

## 2. Runtime substrate

Current custom surfaces:

- `examples/ai-sdr/src/index.ts`
- `examples/ai-sdr/src/services/runtime-bootstrap.ts`
- `examples/ai-sdr/src/services/runtime-context.ts`
- `examples/ai-sdr/src/services/state-plane.ts`

Extraction target:

- Trellis runtime bootstrap package

What should move:

- default actor registry shape
- runtime wiring
- app boot skeleton
- context assembly
- environment resolution

What should remain configurable:

- custom actors
- extra services
- alternate state or runtime providers

## 3. Webhook substrate

Current custom surfaces:

- `examples/ai-sdr/src/services/webhook-security.ts`
- app-specific handler functions in `examples/ai-sdr/src/orchestration/webhook-handlers.ts`
- app-specific route composition in `examples/ai-sdr/src/server.ts`

Extraction target:

- Trellis webhook bootstrap

What should move:

- signature verification helpers
- webhook registration pattern
- provider-to-handler plumbing
- standard paths for signals, discovery, handoff, replies

What should remain configurable:

- custom event shapes
- custom auth modes
- app-specific routes

## 4. Actor workflow substrate

Current custom surfaces:

- `examples/ai-sdr/src/orchestration/discovery-coordinator.ts`
- `examples/ai-sdr/src/orchestration/source-ingest.ts`
- `examples/ai-sdr/src/orchestration/sandbox-broker.ts`
- parts of `examples/ai-sdr/src/orchestration/prospect-workflow.ts`

Extraction target:

- Trellis workflow skeleton package

What should move:

- actor lifecycle pattern
- checkpoint pattern
- retry and failure model
- sandbox-turn orchestration pattern
- provider-run recording pattern

What should remain configurable:

- workflow steps
- branching logic
- stage-specific reasoning
- provider-specific enrich/research decisions

Boundary decision:

- `discovery-coordinator.ts` is reusable **default SDR substrate**, not generic Trellis core
- the reasons are concrete:
  - it owns SDR-specific term frontier management
  - it owns source-specific discovery state
  - it assumes Apify-style run ingestion and poll/reconcile behavior
  - it is useful across multiple SDR-style apps, but not across arbitrary GTM workflows
- that means the next extraction target is:
  - move `discovery-coordinator.ts` toward `packages/default-sdr/`
  - do **not** force it into `@ai-sdr/framework`

## 5. MCP substrate

Current custom surfaces:

- `examples/ai-sdr/src/mcp/trellis-server.ts`
- parts of `examples/ai-sdr/src/services/mcp-tools.ts`

Extraction target:

- first-party Trellis MCP package

What should move:

- server bootstrap
- auth handling
- standard tool groups
- transport defaults

What should remain configurable:

- app-specific tools
- custom actions
- custom read models

## 6. Dashboard substrate

Current custom surfaces:

- parts of `examples/ai-sdr/src/server.ts`

Extraction target:

- Trellis operator shell

What should move:

- auth gate
- base layout
- health/provider/runtime panels
- reusable pipeline widgets

What should remain configurable:

- app-specific panels
- custom KPIs
- workflow-specific controls

## 7. Operational scripts

Current custom surfaces:

- `examples/ai-sdr/scripts/doctor.ts`
- `examples/ai-sdr/scripts/discovery-tick.ts`
- `examples/ai-sdr/scripts/sandbox-probe.ts`
- `examples/ai-sdr/scripts/linkedin_post_chain_probe.py`

Extraction target:

- Trellis CLI and package scripts

What should move:

- doctor
- migrate
- sandbox probe
- generic discovery tick

What should probably stay example-specific for now:

- LinkedIn post-chain probe

That probe is useful, but it is more of an example/debug tool than a core framework primitive.

## Keep App-Specific

The following should remain app-owned longer:

- qualification behavior
- research brief behavior
- copy style
- reply and handoff rules
- campaign strategy
- source strategy
- custom routing

Those are the parts that actually differentiate one GTM app from another.

## Best Next Extractions

If we want the highest leverage path, the next moves should be:

1. extract repository contracts and default state-plane implementation
2. extract runtime bootstrap and actor registry skeleton
3. extract webhook bootstrap
4. extract MCP server bootstrap
5. extract operator dashboard shell

That sequence reduces the biggest day-0 burden first.

## Success Test

This extraction is succeeding when:

- the AI SDR example gets thinner
- new Trellis recipes can reuse the same substrate
- builders spend more time editing manifest, knowledge, and skills
- builders spend less time understanding repository, state, server, and actor internals
