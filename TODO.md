# TODO

This file tracks the remaining work after the current production-hardening pass on `codex-agentic-gtm-framework`.

## Closed in this pass

- pause semantics now stop new intake and let inflight work drain
- discovery burst control and in-flight term dedupe are landed
- lifecycle dispatch is actor-backed for discovery, signal webhook, and inbound reply paths
- dashboard filtering/state rendering is materially better under burst load
- public npm script surface is consistently `trellis:*`
- stale production `capture_signal` rows were paused and noisy follower-count titles were cleaned
- hosted validation is green again:
  - `/healthz`
  - dashboard auth/state
  - `/mcp/trellis`
  - signal ingest
  - fresh-row validation with no stuck `capture_signal` tail

## Remaining work

### 1. Finish full actor ownership of prospect lifecycle

Still outstanding:
- audit for any remaining inline lifecycle paths outside the prospect actor
- make follow-up scheduling and re-entry obviously actor-owned everywhere

Good looks like:
- server/webhook code dispatches
- prospect actors own lifecycle progression
- no ambiguous split between transport handlers and workflow ownership

### 2. Keep collapsing app-specific server glue into the framework

Still outstanding:
- reduce `examples/ai-sdr/src/server.ts` further
- pull any remaining generic webhook/operator transport patterns into `default-sdr`

Good looks like:
- a new Trellis app only wires app policy and providers
- it does not hand-author dashboard, MCP, runtime, and standard webhook transport shells

### 3. Improve operator UX under real burst conditions

Still outstanding:
- confirm the new dashboard filters are enough during large discovery runs
- add more explicit visibility if operators still need Convex/Rivet to understand stalled rows

Good looks like:
- operators can isolate fresh rows and understand pending/paused/failed state without opening backend tooling

### 4. Keep validating discovery quality

Still outstanding:
- keep checking LinkedIn normalization against live payloads
- decide whether other noisy fields besides `title` need hard guards
- keep verifying fallback planner reuse is understandable in production

Good looks like:
- discovery output stays readable and operator-facing titles stay sane

### 5. Decide whether production needs a first-class reset path

Still outstanding:
- evaluate whether Convex cleanup plus Rivet cleanup should become a documented/resettable admin flow

Good looks like:
- stale-state cleanup is deliberate, documented, and not reconstructed from memory next time

## Notes

- Source of truth for issue sequencing remains Linear.
- The current production cleanup/validation scripts are:
  - `npm run trellis:validate:prod`
  - `npm run trellis:cleanup:stale`
