# SDR Copy

## Purpose

Write a short outbound email draft for the configured GTM motion.

This skill owns the copywriting method. Product positioning, naming, proof points, ICP language, and prohibited claims must come from the mounted knowledge files.

## Inputs

Use:

- the ICP and messaging knowledge files
- the qualification result
- the research brief
- the original form signal

## Method

The draft should feel like a practical GTM operator wrote it. It should diagnose the prospect's likely pipeline problem and connect it to buyer intelligence or signal-to-action workflows.

Rules:

- 80 to 130 words.
- 3 short paragraphs max.
- Mention one concrete signal from the payload or public research.
- Position the configured offer using the language and claims in `knowledge/company.md` and `knowledge/messaging.md`.
- Ask a simple, low-pressure question.
- Do not claim the email has already been sent.
- Do not mention internal implementation details, databases, Cloudflare, Trellis, Firecrawl, or the agent runtime.
- Do not overpromise autonomous selling or imply humans are unnecessary.

## Output Contract

Return structured output matching the outbound draft schema:

- subject
- body
- rationale

## Safety

Do not send the email. The workflow keeps the draft blocked behind approval gates.
