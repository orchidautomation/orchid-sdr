# Production Validation

Use this runbook after hardening changes land and before declaring production healthy again.

## Goal

Create one fresh validation window that is easy to inspect without mixing in rows from older broken runs.

## Recommended flow

1. Pick a cutoff timestamp.

Use the moment right before the fresh validation run starts, for example:

```text
2026-04-29T18:00:00.000Z
```

2. Preview stale rows to exclude.

Use `control.previewValidationCleanup` with:

- `before`: the cutoff timestamp
- `limit`: enough to cover the known stale batch

3. Exclude legacy rows from the baseline.

Use `control.applyValidationCleanup` with:

- `before`: the same cutoff timestamp, or explicit `prospectIds`
- `reason`: a concrete note such as `legacy broken runs before hardening`
- optional `batchId`: if you want a stable label for the cleanup batch

This does not delete data. It marks the prospect and its thread as:

- `status = completed`
- excluded from the fresh validation baseline in metadata
- audit logged with `ValidationCleanupExcluded`

4. Run the fresh production proof pass.

Verify the real path you care about:

- discovery tick
- webhook ingest
- prospect creation
- qualification
- research brief generation
- sandbox activity
- dashboard visibility
- MCP inspection

5. Record the new baseline.

Use `pipeline.validationBaseline` with:

- `since`: the cutoff timestamp
- `limit`: enough recent rows to inspect manually

This returns:

- fresh counts for signals, prospects, qualification, research, messages, provider runs, and audit events
- recent fresh prospects only
- discovery health
- recent sandbox jobs
- total count of legacy prospects already excluded

## Notes

- The cleanup is intentionally non-destructive so historical debugging remains possible.
- If a row should stay operational, do not exclude it by cutoff alone; rerun cleanup with explicit `prospectIds`.
- The baseline summary is meant to become the canonical reference point for future regression checks.
