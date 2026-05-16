# Churn Usage Slice

Pull the product telemetry that predicts churn for a Spring Health customer.

Spring's KPIs are not generic SaaS DAU. Focus on registration rate, utilization rate, SpringLife member activity, HR-admin cadence, and care-modality mix.

## Input

- `accountName`
- optional `accountId`

## Data To Retrieve

- eligible lives
- registered members
- active members in last 30 days
- registration rate
- utilization rate over last 12 months
- SpringLife activity trend, trailing 30 days vs prior 30 days
- SpringWorks admin login cadence
- last admin login by title
- care modality mix
- dormant power admins

## Placeholder Tool Calls

These calls can map to Snowflake MCP, Postgres MCP, BigQuery, or an internal read-only warehouse adapter.

```ts
const registration = await tool.usage.query({
  name: "registration_and_utilization",
  accountId,
  sqlRef: "src/integrations/usage-warehouse.map.ts#registrationRate"
});

const springLife = await tool.usage.query({
  name: "springlife_activity_trend",
  accountId,
  windowDays: 60
});

const adminCadence = await tool.usage.query({
  name: "admin_login_cadence",
  accountId,
  windowDays: 90
});
```

Use an aggregate or sanitized replica. Do not pull member-level PHI into Trellis traces or final briefs.

## Output

Return structured evidence:

- `summary`
- `flags`
- `confidence`
- `dataFreshness`
- `details`

## Rules

- Do not use DAU or MAU by itself as a health score.
- Every percentage needs numerator and denominator in `details`.
- Brand-new accounts under 90 days old should not be penalized for low utilization without launch context.
- Usage access should be read-only and aggregated.
