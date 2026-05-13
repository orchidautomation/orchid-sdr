# Trellis Cloud SDR Demo

Trellis GTM agent scaffold for a realistic form-fill SDR workflow. The demo uses a Common Room-style GTM company profile, a real Pylon account research target, Firecrawl-backed Trellis research tools, Cloudflare primitives, durable per-lead threads, and approval-gated outbound drafts.

See `docs/trellis-cloud-demo.md` for the pitch, payload, state map, and workflow walkthrough.

## First Boot

```bash
npm install
npm run cf:login
npm run deploy
npm run smoke
npm run verify
```

The first deploy is Cloudflare-first and does not require Attio, AgentMail, or Firecrawl credentials. Those are connected after the app boots:

```bash
npx wrangler secret put TRELLIS_API_KEY
npm run trellis -- connect attio
npm run trellis -- connect agentmail
npm run trellis -- connect firecrawl
npm run trellis -- connect apify      # optional discovery source
npm run trellis -- connect prospeo    # optional email enrichment
npm run trellis -- docs add ./product-docs
```

Your app code stays Trellis-only in `src/agent.ts`. Durable business state lives in `src/state/prospect.map.ts`: define tables, fields, indexes, and relationships while Trellis keeps D1 migrations private. The generated `src/trellis-runtime.ts` adapter mounts Trellis R2 markdown packs into the virtual sandbox, uses the Cloudflare AI binding through the default AI Gateway, and stores per-thread agent sessions in `TRELLIS_DB`.

Deploy auto-packs the default `knowledge/**/*.md` files, or uses `.trellis/knowledge-pack.json` when you run `trellis docs add <path>`. It also syncs tracked `SKILL.md` files into the `TRELLIS_PACKS` R2 bucket. Outbound writes stay in no-send mode until approval gates are configured.

`GET /healthz` and `GET /smoke` stay public-safe. Once `TRELLIS_API_KEY` is set as a Worker secret, Trellis protects `/webhooks/signals`, `/mcp/trellis`, `/dashboard`, `/approvals/*`, `/operator/*`, and `/provider-actions/*`; call them with `Authorization: Bearer <key>` or `x-trellis-api-key: <key>`.

`POST /smoke/attio` is an explicit provider smoke: it requires `ATTIO_API_KEY` plus `TRELLIS_PROVIDER_SMOKE_TOKEN`, writes a deterministic smoke company/person through the Attio field map, and returns HTTP 200 only when Attio accepts the mapped write.
