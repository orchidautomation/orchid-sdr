# Trellis

Trellis is a vertical GTM agent stack.

It is not trying to be a universal agent framework. Trellis is one curated path for shipping reliable GTM agents: Trellis owns the GTM product contract, runtime, state, workflows, approvals, provider actions, and observability surface.

## The Shape

```bash
trellis init acme-sdr
trellis deploy
trellis verify cloudflare
trellis doctor
trellis smoke
trellis connect attio
trellis connect mail
trellis connect research
trellis connect apify      # optional discovery
trellis connect prospeo    # optional enrichment
trellis docs add ./product-docs
```

The first deploy should require only runtime auth. CRM, email, research, optional discovery/enrichment, and optional trace providers connect after the app is alive.

`trellis connect` writes non-secret provider manifests under `.trellis/providers/` so readiness can be checked without storing credentials.

`trellis deploy` auto-packs the default `knowledge/**/*.md` files. `trellis docs add` is still available when you want an explicit `.trellis/knowledge-pack.json` with markdown file hashes. Deploy syncs that manifest when present, markdown files, and tracked `SKILL.md` files into the Trellis pack store, and the runtime hydrates those markdown files into bounded agent context.

`trellis deploy` also owns the first runtime provisioning pass for the generated app: it resolves or creates the managed database, pack storage, events queue, and dead-letter queue, then runs pack sync and deploy.

`trellis verify cloudflare` checks the generated app shape, local smoke path, pack sync plan, and deploy resource posture. With `--live --url <app-url>` it also verifies auth and deployed `/healthz`, `/mcp/trellis`, and `/smoke`; add `--exercise-agent` to post a safe signal through the live Trellis runtime. Add `--attio-smoke --provider-smoke-token <token>` to run the explicit Attio provider smoke at `POST /smoke/attio`; that route requires `ATTIO_API_KEY` and writes a deterministic smoke company/person through the configured field map.

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
- deploy wiring

## What Trellis Uses

| Concern | Default |
| --- | --- |
| Runtime | managed deploy target |
| Durable identity | Trellis agent runtime |
| Workflows | Trellis workflow runtime |
| Queryable state | managed SQL store |
| Per-agent state | Durable Object SQLite |
| Markdown and artifacts | managed object store |
| Background work | Queues |
| Model routing | AI Gateway |
| Filesystem context | just-bash |
| Full sandbox | runtime sandbox when needed |
| Mail | Trellis mail capability contract |
| Research | Trellis research capability contract |
| Browser automation | Trellis browser capability contract |
| Observability | Trellis trace events, runtime logs, model usage, audit events, optional generic/Langfuse/Braintrust export |

Generated apps keep `app.skill(...)` Trellis-only: Trellis hydrates markdown packs, mounts provider tools, opens the durable session by thread id, and validates returned `data` or JSON text with Zod.

## Public API Target

```ts
import { trellis, schema } from "@trellis/gtm";
import { attio, browser, mail, research } from "@trellis/providers";
import attioMap from "./crm/attio.map";

export default trellis.agent("sdr", {
  crm: attio({ map: attioMap }),
  mail: mail(),
  browser: browser(),
  research: research(),
  model: "anthropic/claude-sonnet-4.6",
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  mcp: { name: "trellis-sdr" },
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

## Repo Map

Use [`examples/gtm-sdr`](./examples/gtm-sdr/) for the GTM SDR example.

Root npm scripts follow that boundary. `npm run build`, `npm run doctor`, `npm run smoke`, `npm run verify`, `npm run dev`, and `npm run build:all` exercise the Trellis deploy path.

The product surface lives in:

- `packages/gtm`
- `packages/providers`
- `docs/provider-capability-matrix.md`
- `examples/gtm-sdr`
- the default `trellis init`, `trellis deploy`, `trellis verify`, `trellis smoke`, `trellis connect`, and `trellis docs add` CLI path

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
