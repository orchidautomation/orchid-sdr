# TODO

This branch is converting Trellis from a generic composition framework into the v3 Cloudflare-first GTM agent stack.

## Current Direction

- Trellis owns the GTM product contract.
- Flue owns the agent harness underneath Trellis.
- Cloudflare owns runtime, storage, queues, workflows, gateway, and observability plumbing.
- The older AI SDR app is parity material, not the public architecture.

## Remaining Work

1. Port the reference AI SDR behavior into `@trellis/gtm`.
2. Replace fixture-only local skill behavior with the real installed Flue package/runtime in generated apps.
3. Verify R2 pack sync and Cloudflare Workflow execution against a real Cloudflare account.
4. Add richer operator controls for dead-letter recovery, replay, pause/resume, and kill switches.
5. Add optional Langfuse/Braintrust trace export on top of `trellis_trace_events`.
6. Keep legacy Convex/Vercel/Rivet paths behind explicit `legacy:*` scripts and migration flags until parity is proven.

## Verification

```bash
npm run build
npm run typecheck
npm test
npm run trellis -- doctor --json
npm run trellis -- smoke --json
npm run trellis -- deploy --json
```
