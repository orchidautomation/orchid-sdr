# TODO

This file tracks the remaining work after the current production-hardening pass on `codex-agentic-gtm-framework`.

## Closed in this pass

- pause semantics now stop new intake and let inflight work drain
- discovery burst control and in-flight term dedupe are landed
- lifecycle dispatch is actor-backed for discovery, signal webhook, and inbound reply paths
- dashboard filtering/state rendering is materially better under burst load, with larger operator windows
- reference-app transport now mounts its dashboard/runtime/MCP surface through framework-owned actor-backed helpers
- a first-class stale-state admin path now exists in the framework, dashboard, and CLI
- public npm script surface is consistently `trellis:*`
- stale production `capture_signal` rows were paused and noisy follower-count titles were cleaned
- hosted validation is green again:
  - `/healthz`
  - dashboard auth/state
  - `/mcp/trellis`
  - signal ingest
  - fresh-row validation with no stuck `capture_signal` tail

## Remaining work

### 1. Keep validating discovery quality

Still outstanding:
- keep checking LinkedIn normalization against live payloads
- decide whether other noisy fields besides `title` need hard guards
- keep verifying fallback planner reuse is understandable in production

Good looks like:
- discovery output stays readable and operator-facing titles stay sane

### 2. Keep shrinking reference-app policy surface

Still outstanding:
- extract any remaining app-specific webhook policy that can live in `default-sdr`
- decide whether the last server-specific policy hooks should become manifest-driven defaults

Good looks like:
- the reference app mainly declares policy and providers
- framework helpers own the transport and actor-backed route assembly

## Notes

- Source of truth for issue sequencing remains Linear.
- The current production cleanup/validation scripts are:
  - `npm run trellis:validate:prod`
  - `npm run trellis:cleanup:stale`
  - `npm run trellis -- admin cleanup-stale [--apply]`
