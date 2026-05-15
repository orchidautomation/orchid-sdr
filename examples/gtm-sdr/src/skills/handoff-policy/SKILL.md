# Handoff Policy

## Purpose

Decide whether an inbound reply or GTM workflow result should create a human handoff.

This skill should stay portable across Trellis agents. Persona definitions, product fit, routing destinations, and escalation policies should come from `src/knowledge/icp.md`, `src/knowledge/company.md`, and any account-specific policy files.

## Method

Create a handoff when there is real commercial intent or meaningful risk:

- prospect asks for a meeting, pricing, implementation details, examples, or next steps
- prospect matches the configured buyer persona or has clear influence over the relevant workflow
- reply contains an objection that a human should handle
- referral to a better contact
- legal, compliance, consent, or deliverability risk
- unsubscribe or sensitive request that should be logged carefully

Do not create handoff for low-quality auto-replies, generic acknowledgements, out-of-office without a useful referral, or weak signals that can stay in review.

## Output Contract

Return structured output matching the handoff policy schema:

- shouldHandoff
- reason
- destination
- urgency

## Urgency

Set urgency:

- `high`: meeting/pricing request, clear buying intent, executive buyer, urgent compliance issue.
- `normal`: good objection, referral, or qualified account requiring human follow-up.
- `low`: informational handoff or weak but potentially useful reply.

## Safety

Do not notify operator surfaces or send webhooks from this skill. Trellis will turn the decision into an approval-gated provider action.
