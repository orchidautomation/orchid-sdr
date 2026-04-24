# TODO

This file is the practical confidence checklist for Orchid SDR.

It is not a product wishlist.
It is the set of things that are still untested, partially tested, or still need tightening before the system feels fully trustworthy in production.

## P0: Must Validate Before Real Outbound

- [ ] Run one real end-to-end AgentMail send/reply smoke test.
  Success looks like:
  - `NO_SENDS_MODE=false`
  - send happens during an allowed quiet-hours window
  - one campaign sender inbox is auto-provisioned or reused
  - the outbound message is written to `messages`
  - `provider_inbox_id`, `provider_thread_id`, and `provider_message_id` are stored
  - replying to the email wakes `/webhooks/agentmail`
  - the thread resumes, classifies the reply, and moves into the right next state

- [ ] Verify the happy-path `mail.send` call through the remote MCP surface.
  Current state:
  - blocked sends now short-circuit correctly
  - the old "hang while blocked" bug was fixed
  Still need:
  - one clean allowed send through MCP with no 502 / timeout behavior

- [ ] Fix or intentionally accept quiet-hours timezone behavior.
  Current state:
  - quiet hours are evaluated in UTC in `src/services/policy-service.ts`
  Need decision:
  - keep UTC and document it
  - or move to campaign-local timezone and test it

- [ ] Decide whether Attio sync should happen automatically after `OutboundSent`.
  Current state:
  - `crm.syncProspect` works
  - Attio writes are deterministic and idempotent
  - Attio sync is still a separate action, not an automatic post-send workflow step
  Need decision:
  - keep manual / explicit
  - or trigger deterministic backend sync on `OutboundSent`

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
  Scenarios:
  - positive
  - objection
  - referral
  - unsubscribe
  - wrong person
  Goal:
  - verify pause / handoff / continue behavior with real provider payloads

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

- [ ] Add a clearer sandbox / preview mode for send testing.
  Current state:
  - `mail.preview` works well
  Nice improvement:
  - a dedicated "generate but do not send and do not mutate state" test tool for operator workflows

## P3: Before Calling It Boring And Reliable

- [ ] Add automated post-send CRM sync if that remains the chosen behavior.
- [ ] Add first-class X discovery once the source adapter is ready.
- [ ] Add per-campaign timezone support if outbound becomes customer-facing.
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

Almost, but not until the AgentMail happy path, reply loop, and quiet-hours behavior are validated cleanly.
