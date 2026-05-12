# TODO

This branch is converting Trellis from a generic composition framework into the v3 Cloudflare-first GTM agent stack.

## Current Direction

- Trellis owns the GTM product contract.
- Flue owns the agent harness underneath Trellis.
- Cloudflare owns runtime, storage, queues, workflows, gateway, and observability plumbing.
- The older AI SDR app is parity material, not the public architecture.

## Remaining Work

1. Run `trellis verify cloudflare --live --url <worker> --exercise-agent` against a real Cloudflare account to prove the generated Flue harness against Cloudflare AI and R2 packs.
2. Verify R2 pack sync and Cloudflare Workflow execution against a real Cloudflare account.
3. Run the live verifier's operator replay/requeue checks against a real Cloudflare Workflow and dead-letter queue.
4. Keep legacy Convex/Vercel/Rivet paths as migration-only behavior fixtures until parity is proven; they should stay unreachable from the v3 CLI surface.

## Local Parity Audit

See `docs/trellis-v3-completion-audit.md`.

Local v3 behavior is covered for the Trellis-first API, generated Cloudflare scaffold, safe smoke workflow, R2 pack plan, signal and reply ingest, provider runs, D1 projections, queues, Workflows, provider executors, MCP/dashboard, operator controls, and observability. The remaining items require live Cloudflare credentials and a deployed Worker URL.

## Verification

```bash
npm run build
npm run typecheck
npm test
npm run trellis -- doctor --json
npm run trellis -- smoke --json
npm run trellis -- deploy --json
npm run trellis -- verify cloudflare --json
```
