# Churn Salesforce Slice

Pull the CRM signals that matter for churn risk on one account.

Use `knowledge/spring-health-reference.md` and `knowledge/churn-risk-rubric.md` before scoring any renewal or sponsor signal.

## Input

- `accountName`
- optional `accountId`

## Data To Retrieve

- account tier and ACV
- contract start and renewal date
- plan year and multi-year flag
- CSM and AE
- health score and QoQ delta
- last QBR date
- executive sponsor
- champion status
- recent opportunities
- recent CSM activity

## Output

Return structured evidence:

- `summary`
- `flags`
- `confidence`
- `dataFreshness`
- `details`

## Rules

- Never invent renewal dates, ACV, health score, or sponsor status.
- Unknown does not mean false.
- Mask personal phone numbers, private emails, salary, compensation, and sensitive HR data.
- This skill reads CRM data. It does not update CRM.
