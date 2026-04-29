# Trellis Production Audit - 2026-04-29

This audit captures the current production state of Trellis across Convex-backed application state and the observed actor/runtime behavior.

Environment:

- Vercel production app: `https://trellis-khaki-beta.vercel.app`
- Convex production deployment: `reminiscent-fly-848`
- Rivet production namespace: `trellis-aisdr-demo-e03f-production-oecn`

## Executive Summary

The current production system is partially operational:

- hosted healthz works
- dashboard auth works
- MCP auth works
- signal webhook ingestion works
- Rivet is connected

But the GTM workflow is not yet healthy end to end. The main failures are:

1. recent prospects are stuck at `capture_signal`
2. qualification is not being stored for those recent prospects
3. `researchBriefs` is empty because workflow progression is not reaching research
4. title normalization for LinkedIn discovery is too permissive and is persisting junk values like follower counts as prospect titles
5. discovery/provider runs are bursting duplicates for the same term
6. pause semantics are misleading: the campaign is paused, but the UI still shows large numbers of `active` threads

## Current Production State

Queried directly from Convex production via public repository functions.

### Dashboard Summary

- signals: `255`
- prospects: `64`
- qualifiedLeads: `0`
- activeThreads: `64`
- pausedThreads: `0`
- providerRuns24h: `36`
- globalKillSwitch: `false`
- noSendsMode: `true`

### Control Flags

- `globalKillSwitch = false`
- `noSendsMode = true`
- `pausedCampaignIds = ["cmp_default"]`

Interpretation:

- the campaign is currently paused
- no-sends mode is enabled
- despite that, threads are still represented as `active` in Convex, which makes the operator surface misleading

## Convex Findings

### 1. Recent prospects are stuck at `capture_signal`

Recent prospects sampled from production all share the same pattern:

- `stage = "capture_signal"`
- `status = "active"`
- `qualification = null`
- `qualificationReason = null`
- `researchBrief = null`
- `messageCount = 0`
- `hasEmail = false`

This is the core pipeline failure right now. Leads are being created, but they are not progressing into qualification or research.

### 2. Prospect workflow failed before qualification

For sampled recent prospects, the only prospect-level audit event is:

- `ProspectWorkflowFailed`

Observed payload:

```json
{
  "error": "ENOENT: no such file or directory, scandir '/var/task/knowledge'",
  "signalId": "sig_..."
}
```

Interpretation:

- the deployed workflow previously resolved the wrong knowledge path
- qualification never ran because the workflow crashed before knowledge loading completed
- that explains:
  - blank qualification summary
  - no stored checks
  - empty research briefs

This root cause has already been patched and redeployed, but the rows currently visible in production still reflect the broken runs created before or during that failure window.

### 3. `researchBriefs` is empty because prospects never reached research

The `researchBriefs` table is empty in production.

This is consistent with the workflow contract:

1. prospect is qualified
2. stage advances to `build_research_brief`
3. `saveResearchBrief(...)` runs

Because qualification never completed for the currently broken prospects, the system never reached the research stage.

So:

- empty `researchBriefs` is not the primary bug
- it is a downstream symptom of workflow failure before qualification

### 4. Title normalization is persisting junk values

Sampled recent prospects include persisted titles like:

- `849 followers`
- `10,434 followers`
- `59 followers`
- `7 followers`
- `43,106 followers`

This is a normalization problem, not a dashboard problem.

Current ingest behavior:

- `prospects.title` is populated from `signal.authorTitle`
- `signal.authorTitle` is derived from loose LinkedIn fields:
  - `jobTitle`
  - `title`
  - `headline`
  - fallback author info

That is too permissive for Apify LinkedIn discovery payloads. Some discovered records represent pages, orgs, or metadata-rich cards rather than clean person profiles, and follower-count-style values are slipping into the title slot.

Impact:

- dashboard prospect rows look untrustworthy
- qualification input quality is degraded
- CRM payload quality will be degraded if the workflow advances

### 5. Sampled snapshots had no attached `sourceSignal`

In sampled `getProspectSnapshot(...)` results for the broken rows:

- `sourceSignal = null`

At the same time, the associated failure audit payloads still reference signal IDs.

This may be a secondary state-shape issue worth checking. At minimum, it means the sampled broken prospects are not resolving a usable source signal in snapshot reads, which can further degrade qualification quality and copy generation.

This needs follow-up before calling the state model stable.

## Actor and Runtime Findings

### 1. Discovery/provider runs are duplicating aggressively

Recent provider runs show many repeated successful runs for the same term:

- repeated `pipeline generation`
- multiple runs created within the same second
- many successful Apify provider runs with different external run IDs

Impact:

- signal bursts flood the dashboard
- operator visibility becomes poor
- prospects are created in clusters faster than the workflow can be inspected
- duplicate or near-duplicate ingest pressure increases

This points to a discovery coordination / tick dedupe issue, not a provider outage.

### 2. Pause semantics are wrong for operator expectations

Current expectation:

- pause should stop new work
- optionally let in-flight work drain
- or explicitly mark active items as paused

Current observed behavior:

- campaign is paused via control flags
- discovery is halted
- workflow progression is effectively halted
- but threads remain `active` in Convex

Impact:

- dashboard claims `64 active threads`
- operator interprets that as “still processing”
- in reality, progression may be blocked

This is a product semantics bug. The dashboard and control model do not agree on what “pause” means.

### 3. Old broken Rivet actor state should not be treated as canonical

There were earlier actor crashes tied to the bad deployed knowledge path. Those actors should not be treated as representative of the current code after the redeploy.

Fresh validation should use:

- newly created actors after the path fix
- not stale crashed actors from the broken deploy window

## What Is Already Fixed

The following issue was fixed and redeployed:

- deployed AI SDR root resolution now correctly points to `examples/ai-sdr/knowledge` and `examples/ai-sdr/skills`
- the previous broken resolution to `/var/task/knowledge` is no longer the intended runtime behavior

This means:

- old broken rows still exist
- new validation must be done on fresh runs after the fix

## What Still Needs Fixing

### Priority 0

1. Validate fresh post-fix runs
   - destroy stale crashed actors
   - run discovery once in a controlled way
   - confirm new prospects receive qualification state
   - confirm `researchBriefs` starts filling

### Priority 1

2. Tighten LinkedIn title normalization
   - stop accepting follower-count-style values as `prospects.title`
   - prefer true person headline / role fields
   - treat company/page metrics as metadata, not title

3. Fix discovery burst / duplicate provider run behavior
   - dedupe concurrent or near-concurrent ticks
   - enforce stronger term-level run suppression
   - keep the dashboard from being flooded by redundant signals

4. Fix pause semantics
   - decide whether pause is:
     - soft pause: stop new work, let in-flight finish
     - hard pause: mark active work as paused immediately
   - then make Convex thread state reflect that honestly

### Priority 2

5. Add a first-class reset path
   - clear Convex operational data
   - clear Rivet actor/discovery state
   - reset control flags
   - avoid manual multi-system cleanup

6. Improve operator visibility
   - fresh-only filter
   - qualification-pending vs workflow-failed badges
   - better pagination and history navigation
   - explicit workflow-error surface in the pipeline view

## Bottom Line

Production state is not random. It is showing a consistent failure chain:

1. discovery is producing signals
2. prospects are being created
3. many recent prospects were created during the bad deployed knowledge-path window
4. those prospects failed before qualification
5. because qualification failed, research briefs were never created
6. title normalization is also too loose, so some prospect rows are structurally poor even when the workflow is otherwise alive

The system is close enough that the failure modes are narrow and concrete now. The next job is not broad architecture work. It is:

- validate fresh post-fix runs
- tighten normalization
- fix discovery dedupe
- fix pause semantics
