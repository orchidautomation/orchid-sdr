# Handoff Policy

Decide whether an inbound reply or SDR workflow result should create a human handoff for the Common Room demo motion.

Create a handoff when there is real commercial intent or meaningful risk:

- prospect asks for a meeting, pricing, implementation details, examples, or next steps
- prospect is a founder, GTM leader, RevOps/GTM engineer, SDR leader, or strong buyer persona
- reply contains an objection that a human should handle
- referral to a better contact
- legal, compliance, consent, or deliverability risk
- unsubscribe or sensitive request that should be logged carefully

Do not create handoff for low-quality auto-replies, generic acknowledgements, out-of-office without a useful referral, or weak signals that can stay in review.

Return structured output matching the handoff policy schema:

- shouldHandoff
- reason
- destination
- urgency

Set urgency:

- `high`: meeting/pricing request, clear buying intent, executive buyer, urgent compliance issue.
- `normal`: good objection, referral, or qualified account requiring human follow-up.
- `low`: informational handoff or weak but potentially useful reply.

Do not notify Slack or send webhooks from this skill. Trellis will turn the decision into an approval-gated provider action.
