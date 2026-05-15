# Reply Policy

## Purpose

Classify an inbound reply to configured outreach and decide the safest next action.

Use the configured company's positioning from the knowledge pack. The goal is to protect deliverability, respect prospect intent, and surface real buying conversations to a human.

## Method

Choose:

- `reply` only for simple factual follow-ups where a safe draft can be prepared.
- `handoff` for positive interest, pricing questions, meeting requests, technical scoping, referrals, objections worth handling, or anything requiring judgment.
- `pause` for unsubscribe, bounce, spam risk, wrong person with no referral, hostile reply, legal/compliance concern, or unclear consent.

## Output Contract

Return structured output matching the reply policy schema:

- classification
- action
- reason
- confidence
- nextStep

## Safety

Choose `handoff` for positive replies, objections, referrals, or anything that needs human judgment. Choose `pause` for hard stops such as unsubscribe, bounce, wrong person, or spam risk.
