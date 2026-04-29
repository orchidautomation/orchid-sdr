# TODO

This file tracks the remaining production-hardening work for Trellis and the AI SDR reference app after the current branch state.

## Current branch baseline

Already landed on `codex-agentic-gtm-framework`:

- `TRELLIS-2`: pause semantics now stop new work at ingest and let in-flight work drain
- `TRELLIS-3`: discovery burst control and in-flight term dedupe
- `TRELLIS-4` partial: actor-backed lifecycle dispatch validated for server and discovery paths
- `TRELLIS-6` partial: paused/failure workflow states render correctly in the dashboard
- `TRELLIS-7` partial: more runtime/server glue is collapsed into `default-sdr`
- public CLI surface is now `trellis`, not `ai-sdr`

## Outstanding work

### 1. Finish `TRELLIS-4` end-to-end lifecycle ownership

Goal:
- make the per-prospect actor the unambiguous owner of prospect lifecycle progression everywhere

Still outstanding:
- audit remaining inline lifecycle execution paths and move them behind actor-owned dispatch where appropriate
- make follow-up scheduling and subsequent lifecycle re-entry uniform across:
  - webhook-originated signals
  - discovery-originated signals
  - reply-triggered work
- verify there are no hidden code paths that still leave rows stuck at `capture_signal`

What good looks like:
- newly ingested prospects quickly move from `capture_signal` into qualification or an explicit paused/failed state
- lifecycle ownership is obvious from the code and not split unpredictably across server, registry, and workflow helpers

### 2. Finish `TRELLIS-6` burst-run operator UX

Goal:
- make high-volume discovery runs inspectable in the dashboard

Still outstanding:
- add better filtering/slicing for fresh rows under burst load
- distinguish clearly between:
  - captured only
  - qualification pending
  - research pending
  - paused before qualification
  - workflow failed
- improve operator visibility into why rows are stalled without requiring Convex inspection

What good looks like:
- an operator can run discovery, isolate the newest rows, and understand progression/failure state without opening Convex or Rivet

### 3. Continue `TRELLIS-7` framework extraction

Goal:
- reduce the amount of app-specific `server.ts` code required by the reference app

Still outstanding:
- extract more generic webhook-to-actor bridging into framework/default-sdr
- extract reusable operator action presets where app-specific policy is not needed
- narrow `server.ts` down to app policy and provider wiring rather than transport/runtime shell

What good looks like:
- a new Trellis app does not need to hand-author a large custom `server.ts` just to get dashboard, MCP, runtime endpoint, and standard webhooks

### 4. Fresh production validation (`TRELLIS-8`)

Goal:
- validate only fresh post-fix production behavior

Still outstanding:
- run a controlled fresh production cycle after the current fixes
- confirm:
  - signals ingest cleanly
  - lifecycle progresses
  - qualification summaries populate
  - research briefs are written when qualification passes
  - paused rows surface honestly
- separate stale pre-fix records from current behavior

What good looks like:
- production validation is based on fresh rows only, not mixed with old broken data

### 5. Data cleanup / backfill

Goal:
- clean up stale state that predates the current fixes

Still outstanding:
- decide whether to backfill, rerun, or archive old rows with:
  - bad LinkedIn titles (`followers`, `connections`, other noisy payload artifacts)
  - empty research briefs caused by old stuck workflows
  - old `capture_signal` rows that never progressed during the broken knowledge-path window
- decide whether production needs a first-class reset/cleanup script for Convex + Rivet state together

What good looks like:
- old broken state no longer obscures whether the current runtime is healthy

### 6. Pause-control polish

Goal:
- make pause semantics operationally obvious

Still outstanding:
- verify pause/resume behavior under real production load
- decide whether paused active threads should be explicitly reclassified or drained differently in the UI
- make sure discovery stop/start behavior is intuitive during manual operator use

What good looks like:
- operators can predict what `Pause Automation` will do without guessing

### 7. Discovery quality follow-ups

Goal:
- improve discovery signal quality and reduce noise

Still outstanding:
- continue validating LinkedIn normalization against real post payloads
- check whether other noisy fields besides `title` need normalization guards
- validate term planning/reuse behavior in production so fallback planner history does not create confusing repeat runs

What good looks like:
- discovery output is relevant, titles are sane, and repeat runs are explainable

## Suggested execution order

1. Finish `TRELLIS-4`
2. Finish `TRELLIS-6`
3. Continue `TRELLIS-7`
4. Run `TRELLIS-8` fresh production validation
5. Clean stale data / backfill

## Notes

- Source of truth for issue tracking remains Linear.
- This file is the repo-local working list so future sessions do not have to reconstruct the current hardening state from chat history.
