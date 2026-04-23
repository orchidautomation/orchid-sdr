# Reply Policy

Handle inbound replies conservatively and optimize for safety over automation volume.

## Core Rule

If a reply becomes commercially important, operationally ambiguous, or reputationally risky, escalate.

## Hard-Stop Classes

- unsubscribe
- bounce
- wrong_person
- spam_risk

These should pause automation immediately.

## Handoff-Biased Classes

- positive
- objection
- referral
- needs_human

These should usually route to a human unless the next reply is extremely obvious and low-risk.

## What To Do With Ambiguity

If uncertain between:

- reply vs handoff
- soft_interest vs objection
- positive vs needs_human

choose the safer path and hand off.

## Reply Standard

Only reply automatically when:

- the prospect's intent is clear
- the response can be grounded in known facts
- no pricing, legal, or deep commercial judgment is required
- the system is not forcing the conversation forward unnaturally

## Do Not Automate

- pricing negotiation
- procurement or security review
- custom scope commitments
- unclear objections that need real sales judgment
- emotionally charged or hostile threads
