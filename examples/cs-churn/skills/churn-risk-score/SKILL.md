# Churn Risk Score

Synthesize Salesforce, Zendesk, and usage evidence into one risk score. This skill never fetches data. It only reasons over prior skill outputs.

## Input

- `salesforce`
- `zendesk`
- `usage`

## Output

Return:

- `score`: 0-100
- `band`: `Green`, `Yellow`, `Orange`, or `Red`
- `topDrivers`: weighted drivers with evidence and weight
- `mitigants`
- `confidence`: `High`, `Medium`, or `Low`
- optional `math`

## Rules

- Use `knowledge/churn-risk-rubric.md` as the source of truth.
- Cite specific evidence from the three input sources.
- If an input source is missing or stale, lower confidence.
- Apply the plan-year override.
- Combine overlapping usage drivers into one plain-English driver when appropriate.
- Do not call Salesforce, Zendesk, warehouse, or Composio tools from this skill. It is a pure scoring reducer over prior outputs.
