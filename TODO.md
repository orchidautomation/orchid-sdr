# TODO

This branch is converting Trellis from a generic composition framework into the v3 Cloudflare-first GTM agent stack.

## Current Direction

- Trellis owns the GTM product contract.
- Flue owns the agent harness underneath Trellis.
- Cloudflare owns runtime, storage, queues, workflows, gateway, and observability plumbing.
- The older AI SDR app is parity material, not the public architecture.

## Remaining Work

1. Port the reference AI SDR behavior into `@trellis/gtm`.
2. Run `trellis verify cloudflare --live --url <worker> --exercise-agent` against a real Cloudflare account to prove the generated Flue harness against Cloudflare AI and R2 packs.
3. Verify R2 pack sync and Cloudflare Workflow execution against a real Cloudflare account.
4. Verify operator replay/requeue controls against a real Cloudflare Workflow and dead-letter queue.
5. Keep legacy Convex/Vercel/Rivet paths as migration-only behavior fixtures until parity is proven; they should stay unreachable from the v3 CLI surface.

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
