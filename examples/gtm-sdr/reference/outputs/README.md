# Demo Outputs

This folder contains human-readable evidence from the deployed Trellis BDR demo.

Use it when recording or presenting the demo so you can show outputs without digging through raw D1 rows during the video.

Current output file:

- `pylon-live-run.md` - current curated Pylon run pulled from deployed D1 and the trace cost endpoint.

Source of truth:

- D1 database: `trellis-cloud-sdr-db`
- Worker: `https://trellis-cloud-sdr.brandon-ccf.workers.dev`
- Trace: `trace_demo_bdr_pylon_ready_20260515_1512`
- Signal: `sig_demo_bdr_pylon_ready_20260515_1512`

Refresh commands:

```bash
npx wrangler d1 execute trellis-cloud-sdr-db --remote --command "SELECT id, workspace_id, thread_id, provider, source, created_at, json_extract(payload_json, '$.company') AS company, json_extract(payload_json, '$.companyDomain') AS domain, json_extract(payload_json, '$.email') AS email, json_extract(payload_json, '$.title') AS title, json_extract(payload_json, '$.message') AS message, json_extract(payload_json, '$.traceId') AS trace_id FROM trellis_signals ORDER BY created_at DESC LIMIT 5;"
```

```bash
npx wrangler d1 execute trellis-cloud-sdr-db --remote --command "SELECT id, signal_id, channel, status, body, updated_at, approval_required_json FROM trellis_drafts ORDER BY updated_at DESC LIMIT 3;"
```

```bash
npx wrangler d1 execute trellis-cloud-sdr-db --remote --command "SELECT id, draft_id, signal_id, action, status, updated_at FROM trellis_approvals ORDER BY updated_at DESC LIMIT 10;"
```

```bash
npx wrangler d1 execute trellis-cloud-sdr-db --remote --command "SELECT type, COUNT(*) AS count FROM trellis_trace_events GROUP BY type ORDER BY count DESC, type;"
```
