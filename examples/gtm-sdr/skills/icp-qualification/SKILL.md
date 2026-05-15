# ICP Qualification

## Purpose

Decide whether an opted-in form, event, product, community, or social signal is worth pursuing for the configured GTM motion.

This skill is deliberately reusable. Company-specific positioning, ICP rules, product language, and examples must come from the mounted `knowledge/` files, not from hard-coded skill instructions.

## Inputs

Read the mounted knowledge files first:

- `knowledge/icp.md`
- `knowledge/company.md`
- `knowledge/messaging.md`

Use the signal context as primary evidence. The best signal payloads include name, email, title, company, companyDomain, consent, formName, message, sourceUrl, and customerStatus.

## Method

When useful, call Firecrawl-backed Trellis research tools:

- `research.search` for targeted public search
- `research.extract` for a specific company, docs, careers, blog, or source URL
- `research.map` only when you need to discover important pages on a company domain

Classification rules:

- `qualified`: clear fit against the configured ICP, plausible buyer or influencer, valid consent or allowed processing basis, and at least one concrete reason the configured offer could help.
- `needs_review`: plausible account but buyer, timing, consent, or evidence is incomplete.
- `disqualified`: not a B2B GTM fit, unsafe to contact, irrelevant role, no consent, or research contradicts the payload.

For form-fill leads, diagnose the likely pipeline problem when possible:

- volume problem
- conversion problem
- qualification problem
- speed-to-lead problem
- routing/ownership problem
- signal quality problem

## Output Contract

Return structured output matching the qualification schema:

- decision
- summary
- confidence
- matchedEvidence
- missingEvidence
- nextStep

## Safety

Do not send email or update CRM state from this skill. Draft only.
