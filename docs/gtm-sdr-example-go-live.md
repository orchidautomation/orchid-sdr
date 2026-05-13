# GTM SDR Example Go-Live

Use the v3 example as the public go-live path:

```bash
cd examples/gtm-sdr
npm install
npm run cf:login
npm run doctor
npm run smoke
npm run deploy
```

The example shows one realistic SDR loop:

- a website or LinkedIn form submits a signal
- Trellis preserves the lead's durable `threadId`
- markdown knowledge and skills are mounted for qualification, research, copy, reply policy, and handoff policy
- Firecrawl-backed Trellis research tools provide current public evidence
- typed skill outputs write database-shaped state
- outbound stays blocked behind approval gates
- the workflow can resume the same thread when a reply arrives later

Provider credentials are optional at first boot. Add them only when you want live provider behavior:

```bash
npx wrangler secret put TRELLIS_API_KEY
npm run trellis -- connect firecrawl
npm run trellis -- connect agentmail
npm run trellis -- connect attio
```

Keep the first run in no-send mode. A green smoke test should prove the app boots, routes signals, validates schemas, writes state, and blocks side effects before any customer-facing action is enabled.

Once `TRELLIS_API_KEY` is configured, Trellis protects `/webhooks/signals`, `/mcp/trellis`, `/dashboard`, `/approvals/*`, `/operator/*`, and `/provider-actions/*`. Use `Authorization: Bearer <key>` or `x-trellis-api-key: <key>` when calling those routes.
