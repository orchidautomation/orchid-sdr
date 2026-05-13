# Migration Plan

This file tracks what should be moved out of the legacy AI SDR reference app and into the v3 Trellis stack.

## Principle

Do not extract generic plumbing for its own sake.

Only move code when it supports the curated v3 product path:

```text
trellis init -> docs add -> doctor -> smoke -> deploy -> connect
```

## Move Into v3

- signal acceptance and normalization
- qualification skill call shape
- prospect and draft projections
- approval gates
- audit events
- dashboard/MCP snapshots
- provider readiness checks
- no-send enforcement
- safe smoke fixtures

## Keep As Builder Content

- ICP markdown
- product markdown
- copy style
- compliance judgment
- handoff policy
- customer-specific workflow branches

## Leave Behind Or Delete Later

- bespoke sandbox broker
- generic provider composition story
- old Convex/Vercel/Rivet deploy path
- app-specific operational scripts that are replaced by `doctor`, `smoke`, and `deploy`

## Current Target Packages

- `@trellis/gtm` for the public GTM runtime
- `@trellis/providers` for curated business provider descriptors
- legacy packages only as compatibility support during migration
