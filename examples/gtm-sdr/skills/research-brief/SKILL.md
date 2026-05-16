# Research Brief

## Purpose

Produce a grounded account/person research brief for the configured GTM workflow.

This skill should work for any Trellis GTM agent. Demo-specific company positioning and ICP details must come from `knowledge/`, not from this file.

## Inputs

Use:

- the original signal payload
- the qualification result
- `knowledge/company.md`
- `knowledge/icp.md`
- `knowledge/messaging.md`
- Cloudflare-backed Trellis research tools when the signal contains a company, domain, person, URL, post, or form message

## Method

Research order:

1. Extract facts from the form payload: person, title, email domain, company, domain, consent, source, message, and customerStatus.
2. Search the company and domain for concise public context.
3. Search for the title/function plus company when the title is specific enough.
4. Extract only promising pages, such as official homepage, docs, careers, blog, customer pages, or the submitted source URL.
5. Prefer evidence that explains the business problem named by the signal and the configured ICP, such as buyer signals, account prioritization, routing, outbound, enrichment, RevOps, speed-to-lead, support, implementation, retention, or pipeline quality.

The brief should answer:

- what the company does
- what the lead appears to care about
- why the account/person might care about the configured offer
- what public evidence supports that hypothesis
- what should be avoided in the email
- what one angle the copywriter should use

## Output Contract

Return structured output matching the research brief schema:

- summary
- confidence
- evidence
- sources
- copyGuidance

## Safety

Include today's date from runtime context if recency matters. Do not invent facts when the signal, research tools, or knowledge pack do not support them. If research is thin, say that directly and lower confidence.
