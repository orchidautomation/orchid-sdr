# Trellis v3 Completion Audit

Date: 2026-05-12

Branch: `codex/trellis-v3-cloudflare-parity`

## Objective

Reach feature parity with the existing AI SDR/reference app using the reference app as the behavior baseline, while reshaping the implementation around the Trellis v3 product direction:

- one curated GTM stack
- Trellis-first public API
- Flue hidden behind the happy path
- Cloudflare hidden behind the happy path where practical
- reliable deploy, smoke, observability, queue, workflow, and operator defaults
- first boot requiring only Cloudflare credentials
- provider credentials connected after boot
- old Convex, Rivet, Vercel, and generic composition surfaces kept out of the v3 happy path

## Prompt-To-Artifact Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Start a new branch for the v3 work | Current branch is `codex/trellis-v3-cloudflare-parity`. | Done |
| Capture the v3 vision with Flue and Cloudflare primitives | `docs/trellis-v3-vision.md` describes Trellis as a vertical GTM stack, Flue as the hidden harness, Cloudflare as runtime/storage/workflow substrate, and includes the one-screen demo agent. | Done |
| Define parity against the existing AI SDR/reference app | `docs/trellis-v3-parity-contract.md` maps boot/deploy, knowledge, signal ingest, lifecycle, providers, MCP/dashboard, and observability. | Done |
| Use Trellis-first API, not Flue/Cloudflare in app code | Generated `src/agent.ts` is validated in `packages/trellis-cli/src/init-scaffold.test.ts` to contain `trellis.agent(...)` and no `@flue/sdk`, `FlueContext`, or direct Cloudflare imports. | Done |
| Hide Flue behind the generated runtime | Generated `src/trellis-flue.ts` uses `@flue/sdk/cloudflare`, `getVirtualSandbox`, Cloudflare AI binding provider, R2 pack hydration, and `TRELLIS_FLUE_CONTEXT_FACTORY`; `@trellis/gtm` accepts that hidden factory. | Source/test proven |
| First boot only requires Cloudflare credentials | `trellis init` creates Cloudflare bindings and package scripts; `trellis deploy --json` reports `requiresProviderCredentials: false`, `noSendsMode: true`, `smokeMode: true`; provider manifests are connected later. | Local proven |
| Cloudflare-first deploy path | `trellis deploy` defaults to Cloudflare, rejects Vercel target, provisions/verifies D1, R2, Queues/DLQ, and Workflows from generated Wrangler config, syncs packs, then runs Wrangler deploy when applied. | Local/source proven |
| Safe smoke workflow | `npm run trellis -- smoke --json` passes and shows fixture signal, prospect, qualification/research/copy skills, draft, approvals, no-send mode, and audit events. | Local proven |
| Generated app first-run spine | `packages/trellis-cli/src/init-scaffold.test.ts` runs `init`, `docs add`, `doctor`, `smoke`, `deploy --json`, `verify cloudflare --json`, and `connect` flows in a generated app directory. | Test proven |
| Markdown knowledge and skill loading | R2 pack reading and bounded hydration live in `packages/gtm/src/index.ts`; CLI pack sync is in `packages/trellis-cli/src/cli.ts`; generated Flue adapter preloads knowledge and skills into `/workspace`. | Local/source proven |
| Signal ingest parity | `/webhooks/signals` accepts raw records, `{ signal }`, and `{ signals: [...] }`, normalizes source payload fields, derives stable ids/source refs, persists D1 projections, queues events, and dispatches workflows. | Test proven |
| AgentMail reply ingest parity | `/webhooks/agentmail` verifies and normalizes `message.received` into a Trellis reply signal, then runs the reply workflow path. | Test proven |
| Provider run visibility | `trellis_provider_runs` records inbound source runs; MCP/dashboard snapshots expose provider-run counts and recent rows. | Test proven |
| Prospect lifecycle parity | The v3 runtime creates prospect projections, drafts, approvals, provider action intents, follow-up workflows, reply/handoff drafts, and operator-gated provider execution. | Test proven |
| Provider connection parity | `trellis connect attio`, `agentmail`, and `firecrawl` write non-secret manifests and readiness checks; provider credentials are not boot blockers. | Test proven |
| Built-in provider executors | AgentMail `email.send`, AgentMail `mail.reply`, Attio `crm.update`, and `handoff.webhook` executor paths are covered with trace headers/context and failure handling. | Test proven |
| MCP/dashboard parity | `/mcp/trellis`, `/dashboard`, provider-action views, operator controls, knowledge inspection, workflow replay, approval routes, and agent snapshots are covered. | Test proven |
| Operator controls | Global kill switch, campaign/thread pause/resume, workflow replay, provider-action requeue, approval approve/reject, no-send guards, and blocked executions are covered locally. | Test proven |
| Observability and reliability | D1 trace events, audit events, provider-run records, workflow-run records, smoke history, optional trace exporters, queue retries, and DLQ-style provider action recovery are covered. | Local/test proven |
| Legacy happy-path removal | `trellis add`, `init --legacy/--kit`, and Vercel deploy target are rejected from the v3 CLI surface; docs mark legacy reference app/framework packages as parity material only. | Test proven |

## Verification Commands

Latest local verification on this branch:

```bash
npm test
npm run build
npm run build:all
npm run typecheck
git diff --check
npm run trellis -- doctor --json
npm run trellis -- smoke --json
npm run trellis -- deploy --json
npm run trellis -- verify cloudflare --json
```

Observed results:

- `npm test`: 39 test files, 160 tests passed.
- `npm run build`: packages build passed.
- `npm run build:all`: v3 packages plus legacy parity packages build passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `trellis smoke --json`: safe fixture workflow passed.
- `trellis deploy --json`: Cloudflare plan produced, with root-level warnings because the repo root is not a generated app directory.
- `trellis verify cloudflare --json`: local verification passed; live checks were skipped because no deployed worker URL or live Cloudflare auth was supplied.

## Unfinished Or Weakly Verified Items

These are not complete enough to mark the whole objective achieved:

1. Live Cloudflare verification has not been run.
   Required command:
   ```bash
   trellis verify cloudflare --live --url https://<worker> --exercise-agent
   ```

2. R2 pack sync and real Cloudflare Workflow execution have not been proven against a live Cloudflare account in this workspace.

3. Operator replay/requeue behavior is locally covered with fake D1, fake Queue, and fake Workflow bindings, but not verified against a real Cloudflare Workflow plus dead-letter queue.

4. The generated Flue adapter is source/test validated, but a real Flue session using Cloudflare AI binding and R2-mounted packs has not been exercised remotely.

## Current Conclusion

Local v3 implementation parity is strong and the public architecture matches the Trellis v3 direction.

The objective should not be marked complete yet because the remaining live Cloudflare gates require credentials, provisioned resources, and a deployed worker URL.
