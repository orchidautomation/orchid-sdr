# Churn Zendesk Slice

Surface support signals that predict churn: rising volume, negative sentiment, repeated unresolved issues, SLA misses, and executive escalations.

Use `knowledge/spring-health-reference.md` to map subjects and tags into Spring-specific themes such as eligibility mismatch, provider-match wait, reporting gap, mobile-app issue, and billing/invoice friction.

## Input

- `accountName`
- optional `accountId`

## Data To Retrieve

- ticket count in last 90 days and prior 90 days
- open tickets older than 14 days
- urgent/P1 tickets
- executive escalation tags
- CSAT average and sample size
- SLA miss rate
- recurring themes inferred from tags and subjects
- last 3 tickets by subject only

## Output

Return structured evidence:

- `summary`
- `flags`
- `confidence`
- `dataFreshness`
- `details`

## Rules

- Never quote raw ticket bodies.
- Label themes as inferred unless the ticket tag directly names the theme.
- If Zendesk access fails, return `Not available` and lower confidence.
- This skill reads support data. It does not write tickets or notify customers.
