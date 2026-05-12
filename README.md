# Trellis

Trellis is a vertical GTM agent stack.

It is not trying to be a universal agent framework. The v3 direction is one curated path for shipping reliable GTM agents: Trellis owns the GTM product contract, Flue handles the agent harness under the hood, and Cloudflare supplies the durable runtime, storage, workflows, queues, and observability substrate.

## The Shape

```bash
trellis init acme-sdr
trellis deploy
trellis doctor
trellis smoke
trellis connect attio
trellis connect agentmail
trellis connect firecrawl
trellis docs add ./product-docs
```

The first deploy should require only Cloudflare auth. CRM, email, research, and optional trace providers connect after the app is alive.

`trellis connect` writes non-secret provider manifests under `.trellis/providers/` so readiness can be checked without storing credentials.

`trellis docs add` writes `.trellis/knowledge-pack.json` with markdown file hashes so the pack can be verified locally. `trellis deploy` syncs the knowledge manifest, markdown files, and tracked `SKILL.md` files into `TRELLIS_PACKS`.

`trellis deploy` also owns the first Cloudflare provisioning pass for the generated app: it resolves or creates the D1 database and writes the `database_id`, creates or verifies the R2 buckets, creates or verifies the events queue and dead-letter queue, then runs the pack sync and Wrangler deploy.

## What Trellis Owns

- GTM app layout
- markdown knowledge and skill packs
- normalized signal contracts
- prospect, thread, approval, and audit schemas
- provider setup conventions
- no-send and approval gates
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
| Observability | Workers logs, AI Gateway logs, audit events, optional Langfuse/Braintrust |

## Public API Target

```ts
import { trellis, schema } from "@trellis/gtm";
import { agentmail, attio, firecrawl } from "@trellis/providers";

export default trellis.agent("sdr", {
  crm: attio(),
  email: agentmail(),
  research: firecrawl(),
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound(),
}, async (app) => {
  const signal = await app.signal();
  const qualification = await app.skill("icp-qualification", {
    context: await app.context(signal),
    schema: schema.qualification(),
  });

  return app.workflow("prospect").start({ signal, qualification });
});
```

## Current Branch Status

The repo still contains the older reference app and framework-composition packages. They are useful as behavior/parity source material, not the v3 public architecture.

The v3 surface now lives in:

- `packages/gtm`
- `packages/providers`
- `docs/trellis-v3-vision.md`
- `docs/trellis-v3-parity-contract.md`
- the default `trellis init`, `trellis deploy`, `trellis smoke`, `trellis connect`, and `trellis docs add` CLI path

Legacy composition commands remain available only for migration work with explicit legacy/development intent.

## Verify

```bash
npm run typecheck
npm test
npm run trellis -- help
npm run trellis -- doctor --json
npm run trellis -- smoke --json
npm run trellis -- deploy --json
```
