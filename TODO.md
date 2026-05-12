# TODO

This branch is converting Trellis from a generic composition framework into the v3 Cloudflare-first GTM agent stack.

## Current Direction

- Trellis owns the GTM product contract.
- Flue owns the agent harness underneath Trellis.
- Cloudflare owns runtime, storage, queues, workflows, gateway, and observability plumbing.
- The older AI SDR app is parity material, not the public architecture.

## Remaining Work

1. Port the reference AI SDR behavior into `@trellis/gtm`.
2. Replace fixture skills with Flue-backed skill execution.
3. Upload and mount knowledge/skill packs through R2.
4. Turn approval records into executable approve/reject actions.
5. Add real provider side-effect adapters behind no-send and approval gates.
6. Verify the generated Cloudflare scaffold against a real account.
7. Keep legacy Convex/Vercel/Rivet paths behind explicit `legacy:*` scripts and migration flags.

## Verification

```bash
npm run build
npm run typecheck
npm test
npm run trellis -- doctor --json
npm run trellis -- smoke --json
npm run trellis -- deploy --json
```
