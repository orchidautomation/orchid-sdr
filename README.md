# Trellis

Trellis is a vertical GTM agent stack.

It is not trying to be a universal agent framework. The v3 direction is one curated path for shipping reliable GTM agents: Trellis owns the GTM product contract, Flue handles the agent harness under the hood, and Cloudflare supplies the durable runtime, storage, workflows, queues, and observability substrate.

## The Shape

```bash
trellis init acme-sdr
trellis deploy
trellis verify cloudflare
trellis doctor
trellis smoke
trellis connect attio
trellis connect agentmail
trellis connect firecrawl
trellis connect apify      # optional discovery
trellis connect prospeo    # optional enrichment
trellis docs add ./product-docs
```

The first deploy should require only Cloudflare auth. CRM, email, research, optional discovery/enrichment, and optional trace providers connect after the app is alive.

`trellis connect` writes non-secret provider manifests under `.trellis/providers/` so readiness can be checked without storing credentials.

`trellis deploy` auto-packs the default `knowledge/**/*.md` files. `trellis docs add` is still available when you want an explicit `.trellis/knowledge-pack.json` with markdown file hashes. Deploy syncs that manifest when present, markdown files, and tracked `SKILL.md` files into `TRELLIS_PACKS`, and the runtime hydrates those markdown files into bounded agent context.

`trellis deploy` also owns the first Cloudflare provisioning pass for the generated app: it resolves or creates the D1 database and writes the `database_id`, creates or verifies the R2 buckets, creates or verifies the events queue and dead-letter queue, then runs the pack sync and Wrangler deploy.

`trellis verify cloudflare` checks the generated app shape, local smoke path, pack sync plan, and Cloudflare resource posture. With `--live --url <worker-url>` it also verifies Wrangler auth and deployed `/healthz`, `/mcp/trellis`, and `/smoke`; add `--exercise-agent` to post a safe signal through the live Flue/Cloudflare harness.

## What Trellis Owns

- GTM app layout
- markdown knowledge and skill packs
- normalized signal contracts
- prospect, thread, approval, and audit schemas
- provider setup conventions
- no-send and approval gates
- provider action execution with no-send/status guards
- smoke tests
- MCP and dashboard inspection surfaces
- Cloudflare deploy wiring

## What Trellis Uses

| Concern | Default |
| --- | --- |
| Agent harness | Flue, hidden behind Trellis |
| Runtime | Cloudflare Workers |
| Durable identity | Cloudflare Agents / Durable Objects |
| Workflows | Cloudflare Workflows |
| Queryable state | D1 |
| Per-agent state | Durable Object SQLite |
| Markdown and artifacts | R2 |
| Background work | Queues |
| Model routing | AI Gateway |
| Filesystem context | just-bash |
| Full sandbox | Cloudflare Sandbox when needed |
| Browser automation | Browser Run / sandbox provider slot |
| Observability | D1 trace events, Workers logs, AI Gateway logs, audit events, optional generic/Langfuse/Braintrust export |

Generated apps install `@flue/sdk` and create a hidden Flue context factory in the Worker wrapper. `app.skill(...)` stays Trellis-only: Trellis hydrates R2 markdown packs, passes Firecrawl/Trellis MCP tools into Flue, opens the session by thread id, and validates returned `data` or JSON text with Zod.

## Public API Target

```ts
import { trellis, schema } from "@trellis/gtm";
import { agentmail, attio, firecrawl } from "@trellis/providers";

export default trellis.agent("sdr", {
  crm: attio(),
  email: agentmail(),
  research: firecrawl(),
  model: trellis.model({
    env: "TRELLIS_MODEL",
    default: "cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  }),
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound(),
}, async (app) => {
  const signal = await app.signal();
  const context = await app.context(signal);
  const qualification = await app.skill("icp-qualification", {
    context,
    schema: schema.qualification(),
  });
  const research = await app.skill("research-brief", {
    context,
    args: { qualification },
    schema: schema.researchBrief(),
  });
  const draft = await app.skill("sdr-copy", {
    context,
    args: { qualification, research },
    schema: schema.outboundDraft(),
  });

  return app.workflow("prospect").start({ signal, qualification, research, draft });
});
```

## Current Branch Status

The repo still contains the older reference app and framework-composition packages. They are behavior/parity source material only, not the v3 public architecture.

Root npm scripts now follow that boundary. `npm run build`, `npm run doctor`, `npm run smoke`, `npm run verify`, and `npm run dev` exercise the v3 Trellis/Cloudflare path. The v3 CLI rejects old composition commands even when a legacy flag is passed. The old AI SDR baseline is still available only through explicit `legacy:*` scripts and `npm run build:all`.

The v3 surface now lives in:

- `packages/gtm`
- `packages/providers`
- `docs/trellis-v3-vision.md`
- `docs/trellis-v3-parity-contract.md`
- the default `trellis init`, `trellis deploy`, `trellis verify`, `trellis smoke`, `trellis connect`, and `trellis docs add` CLI path

Migration compatibility stays out of the default help, scaffold, docs, deploy story, and CLI escape hatches.

## Verify

```bash
npm run typecheck
npm test
npm run build
npm run trellis -- help
npm run trellis -- doctor --json
npm run trellis -- smoke --json
npm run trellis -- deploy --json
npm run trellis -- verify cloudflare --json
```
