# Live Demo Result

Representative worker:

- URL: `https://<your-worker>.<your-subdomain>.workers.dev`
- Signal: `sig_pylon_form_005`
- Trace: `trace_pylon_form_005`
- Thread: `lead:pylon:alex-rivera`
- Status: `qualified`
- Draft status: `blocked_pending_approval`
- Approval gates created: `email.send`, `crm.update`

## Draft Created

Subject: Buyer signal quality

Saw your note about Clay-style research and AI SDR reliability -- specifically knowing which signals are real and routing them correctly.

Pylon's product surfaces real account signals and routes by intent on the support side; the same discipline likely applies to your GTM motion: which buyer signals matter, who owns the next step, and how to preserve context instead of generating one-off emails.

Common Room helps RevOps teams unify buyer signals into prioritized, approval-gated action with richer account context. Worth comparing notes on how you're thinking about signal quality before AI SDR execution?

## What The Agent Used

- Form-fill signal from `docs/demo-form-payload.json`
- Common Room demo company, ICP, and messaging markdown in `knowledge/`
- SDR skills in `skills/`
- Firecrawl-backed Trellis research tools
- D1 persisted signal, prospect, draft, approvals, workflow, audit, and per-thread session state
- R2-mounted knowledge and skill packs
- Cloudflare AI Gateway model route configured in `wrangler.jsonc`

The run completed all three skills through the model path: `icp-qualification`, `research-brief`, and `sdr-copy`.
