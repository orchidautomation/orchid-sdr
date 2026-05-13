# Trellis Reference App

This directory is the legacy AI SDR behavior baseline.

It is useful because it shows the product behavior Trellis v3 must reach:

```text
signal -> research -> qualify -> persist -> inspect -> draft -> approve -> sync/send -> reply -> handoff
```

It is not the architecture users should start with. The v3 path is:

```bash
npm run trellis -- init ../acme-sdr --name acme-sdr
npm run trellis -- docs add ./knowledge
npm run trellis -- doctor
npm run trellis -- smoke
npm run trellis -- deploy
```

## What To Port Forward

- normalized signal ingest
- ICP qualification behavior
- research brief behavior
- outbound draft and policy checks
- reply classification
- handoff policy
- CRM sync semantics
- dashboard and MCP inspection
- auditability and no-send safety defaults

## What Not To Carry Forward

- Convex as a required user choice
- Vercel Sandbox as the default harness for every turn
- Rivet as the required runtime plane
- generic provider composition as the product story
- setup docs that make users assemble the stack by hand

## Verification

The tests under `examples/reference-app/tests/` remain valuable parity tests while the v3 packages absorb the behavior.
