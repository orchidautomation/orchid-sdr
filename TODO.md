# TODO

This file is the practical confidence checklist for Orchid SDR.

It is not a product wishlist.
It is the set of things that are still untested, partially tested, or still need tightening before the system feels fully trustworthy in production.

## P0: Must Validate Before Real Outbound

- [x] Complete the real AgentMail send/reply smoke test.
  Proven on Apr 24, 2026:
  - `NO_SENDS_MODE=false` path works when intentionally enabled
  - one campaign sender inbox was auto-provisioned and pinned
  - the outbound message was written to `messages`
  - `provider_inbox_id`, `provider_thread_id`, and `provider_message_id` were stored
  - the happy-path `mail.send` call through the remote MCP surface completed successfully
  - replying to the email woke `/webhooks/agentmail`
  - the inbound message was stored
  - the reply was classified as `positive`
  - the thread moved into `respond_or_handoff`
  - with `NO_SENDS_MODE=true` restored, the thread paused safely after the inbound path

- [x] Verify the happy-path `mail.send` call through the remote MCP surface.
  Proven on Apr 24, 2026:
  - blocked sends short-circuit correctly
  - the old "hang while blocked" bug was fixed
  - the policy-check hang was fixed with timeout fallback
  - the AgentMail sender provisioning bug was fixed (invalid `client_id` format)
  - one clean allowed send through MCP completed and advanced the thread to `await_reply`

- [x] Fix quiet-hours timezone behavior.
  Proven on Apr 24, 2026:
  - quiet hours are evaluated in the campaign's local IANA timezone
  - the default campaign was updated live to `America/New_York`
  - new campaigns inherit `DEFAULT_CAMPAIGN_TIMEZONE`
  - the first-party MCP now exposes `control.setCampaignTimezone` for live updates

- [x] Auto-sync Attio after `OutboundSent` and promote the card on classified replies.
  Current state:
  - first outbound can auto-run the deterministic `crm.syncProspect` path at `ATTIO_AUTO_OUTBOUND_STAGE`
  - reply classification can auto-promote the same Attio card using the positive / negative reply stage envs
  - manual `crm.syncProspect` still exists for operator control

## P1: Strong Confidence Tests

- [ ] Run a full discovery -> qualification -> research -> database append loop on a fresh signal source and verify all artifacts.
  Verify:
  - `signals`
  - `prospects`
  - `threads`
  - `research_briefs`
  - audit events
  - dashboard state
  - MCP state

- [ ] Test generic `/webhooks/signals` with at least one non-Apify source payload.
  Good candidates:
  - manual test source
  - X/Twitter-like normalized payload
  - another public-signal source
  Goal:
  - prove the normalized signal contract is real, not just Apify-compatible

- [ ] Validate Apify failure and retry paths.
  Specifically:
  - empty run
  - malformed payload
  - webhook misses / late arrivals
  - repeated deliveries
  - provider run failure visibility in dashboard + MCP

- [ ] Re-score or refresh older prospects after major qualification logic changes.
  Current state:
  - new prospects use the current framework
  - older rows may still reflect older qualification behavior
  Need:
  - one explicit re-qualification job or procedure

- [ ] Test reply classification and handoff on real inbound examples.
  Proven on Apr 24, 2026:
  - positive reply path works end to end with real AgentMail webhook payloads
  Still need scenarios:
  - objection
  - referral
  - unsubscribe
  - wrong person
  Goal:
  - verify pause / handoff / continue behavior with real provider payloads across those classes

## P2: Operational Hardening

- [ ] Persist richer sandbox logs.
  Current state:
  - sandbox job status/output/error is visible
  Missing:
  - clean raw stdout/stderr or transcript-grade logs for failed turns

- [ ] Improve operator visibility for why sends are blocked.
  Current state:
  - reasons exist in the tool path and thread pause reason
  Better:
  - one clean dashboard/MCP surface for blocked-send diagnostics

- [ ] Add a manual `research.rebuild` or `lead.refreshResearch` control.
  Why:
  - useful after changing copy skills, research-brief format, or ICP docs

- [ ] Add a one-off Attio duplicate cleanup tool for old records created before stronger idempotency.
  Current state:
  - future syncs are much better
  - historical duplicate people may still exist

- [ ] Stabilize live `mail.preview` latency for on-demand sandbox drafts.
  Current state:
  - the draft path works conceptually and has produced good copy
  - live preview calls can still hang long enough to feel broken in operator workflows
  Need:
  - timeout / queueing / better operator visibility so preview behaves predictably

- [ ] Add a clearer sandbox / preview mode for send testing.
  Current state:
  - `mail.preview` exists, but the live operator experience is still not reliable enough
  Nice improvement:
  - a dedicated "generate but do not send and do not mutate state" test tool for operator workflows

## P3: Before Calling It Boring And Reliable

- [x] Add automated post-send CRM sync if that remains the chosen behavior.
- [ ] Add first-class X discovery once the source adapter is ready.
- [x] Add per-campaign timezone support if outbound becomes customer-facing.
- [ ] Add stronger throughput / cost / conversion scorecards.
- [ ] Add one prospect detail page that shows:
  - qualification reasoning
  - research brief
  - copy guidance
  - send / reply history
  - CRM sync state

## What Already Looks Good

These are not TODOs, just reminders of what is already in decent shape:

- [x] discovery scheduling via Rivet actors
- [x] Firecrawl-backed research path
- [x] ICP-driven qualification framework
- [x] draft preview path through MCP
- [x] remote MCP operator surface
- [x] Attio deterministic sync with stored IDs
- [x] campaign sender guardrails for AgentMail
- [x] simpler README and separate reference docs

## Current Bottom Line

If the question is:

"Can this be open-sourced and shown publicly?"

The answer is yes.

If the question is:

"Can this run real outbound with confidence?"

The answer is:

Yes for operator-guided outbound, with `mail.preview` latency still the main rough edge to smooth out.
