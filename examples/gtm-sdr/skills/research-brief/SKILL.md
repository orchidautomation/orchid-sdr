# Research Brief

Produce a grounded account/person research brief for the Common Room demo SDR workflow.

Use:

- the original signal payload
- the qualification result
- `knowledge/company.md`
- `knowledge/icp.md`
- `knowledge/messaging.md`
- Firecrawl-backed Trellis research tools when the signal contains a company, domain, person, URL, post, or form message

Research order:

1. Extract facts from the form payload: person, title, email domain, company, domain, consent, source, message, and customerStatus.
2. Search the company and domain for concise public context.
3. Search for the title/function plus company when the title is specific enough.
4. Extract only promising pages, such as official homepage, docs, careers, blog, customer pages, or the submitted source URL.
5. Prefer evidence that explains a GTM workflow problem: buyer signals, account prioritization, routing, outbound, enrichment, RevOps, speed-to-lead, or pipeline quality.

The brief should answer:

- what the company does
- what the lead appears to care about
- why the account/person might care about Common Room
- what public evidence supports that hypothesis
- what should be avoided in the email
- what one angle the copywriter should use

Return structured output matching the research brief schema:

- summary
- confidence
- evidence
- sources
- copyGuidance

Include today's date from runtime context if recency matters. Do not invent facts when the signal, research tools, or knowledge pack do not support them. If research is thin, say that directly and lower confidence.
