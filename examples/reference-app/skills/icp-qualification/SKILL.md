---
name: "icp-qualification"
description: "Qualify people and companies against the active Trellis ICP using signal, profile, and company evidence."
---

# ICP Qualification

Run this pipeline every time you decide whether a lead matches the current ICP in `knowledge/icp.md`.

## Goal

Qualify only real buyer, operator, company, and timing fit according to the active ICP document. Do not qualify someone on topical overlap alone.

## Required Sequence

1. Read the source post or source signal first.
2. If the source signal is clearly irrelevant, generic, non-buyer noise, or an obvious poor-fit case, reject early before doing deeper profile or company research.
3. Inspect the author profile if a profile URL is available and the signal looks plausibly relevant.
4. Inspect the company page if a company URL or company domain is available and the signal still looks plausibly relevant.
5. If useful, check recent company news with Firecrawl search to understand timing, launches, funding, hiring, or other supporting context.
6. Compare the combined evidence against `knowledge/icp.md`.
7. Decide:
   - is the person qualified?
   - is the company qualified?
   - is there relevant pain, timing, or buying intent?
   - are there explicit negatives or exclusion signals?

## What Counts As Strong Fit

- the person matches the ICP's target roles, personas, or segments
- the company matches the ICP's account or company criteria
- the post/profile/company evidence shows ICP-aligned pains, triggers, or buying signals
- the evidence is direct enough that a reasonable operator would act on it

## What Should Usually Be Rejected

- the person does not match the ICP buyer/operator profile
- the company context does not match the ICP
- the evidence is only adjacent or speculative
- the ICP's negative signals or poor-fit criteria are present

## Decision Rules

- Require identity and source provenance.
- Produce separate verdicts for person fit, company fit, and pain/trigger fit.
- Require evidence of person fit, company fit, and pain/trigger fit unless the ICP document clearly leaves one of those areas unspecified.
- Treat post content as the first gating layer. If it is clearly junk or obviously poor fit, reject before deep research.
- Treat post content as weak evidence unless the role and company context support the fit.
- Treat company news as supporting context, not a replacement for role/company/post evidence.
- Prefer direct observed facts over optimistic inference.
- When evidence is mixed, reject for now and explain what is missing.

## Output Style

- Be explicit about why the lead passed or failed.
- Separate matched ICP segments from softer supporting signals.
- Call out disqualifiers directly when present.
- Make it obvious whether the person qualified, the company qualified, and the signal qualified.
- Keep the summary crisp and operational.
