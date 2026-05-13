# ICP Qualification

Decide whether an opted-in form or LinkedIn lead is worth pursuing for the Common Room demo SDR motion.

Read the mounted knowledge files first:

- `knowledge/icp.md`
- `knowledge/company.md`
- `knowledge/messaging.md`

Use the signal context as primary evidence. The best signal payloads include name, email, title, company, companyDomain, consent, formName, message, sourceUrl, and customerStatus.

When useful, call Firecrawl-backed Trellis research tools:

- `research.search` for targeted public search
- `research.extract` for a specific company, docs, careers, blog, or source URL
- `research.map` only when you need to discover important pages on a company domain

Classification rules:

- `qualified`: clear B2B GTM signal, plausible buyer, valid consent, and at least one concrete reason Common Room could help.
- `needs_review`: plausible account but buyer, timing, consent, or evidence is incomplete.
- `disqualified`: not a B2B GTM fit, unsafe to contact, irrelevant role, no consent, or research contradicts the payload.

For form-fill leads, diagnose the likely pipeline problem when possible:

- volume problem
- conversion problem
- qualification problem
- speed-to-lead problem
- routing/ownership problem
- signal quality problem

Return structured output matching the qualification schema:

- decision
- summary
- confidence
- matchedEvidence
- missingEvidence
- nextStep

Do not send email or update CRM state from this skill. Draft only.
