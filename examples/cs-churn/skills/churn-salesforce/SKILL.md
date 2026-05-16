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

## Placeholder Tool Calls

These names are intentionally provider-neutral placeholders. Replace them with Salesforce Hosted MCP tools, Composio Salesforce toolkit tools, or direct Salesforce API adapter calls in the deployment host.

```ts
const account = await tool.salesforce.query({
  soql: "SELECT Name, Id, Account_Tier__c, ACV__c, Contract_Start__c, Renewal_Date__c, Plan_Year__c, Multi_Year__c, Owner.Name, CSM__c, Health_Score__c, Last_QBR_Date__c, Executive_Sponsor__c, Champion__c FROM Account WHERE Name = :accountName OR Id = :accountId LIMIT 1"
});

const opportunities = await tool.salesforce.query({
  soql: "SELECT StageName, Amount, CloseDate, Type FROM Opportunity WHERE AccountId = :accountId ORDER BY CloseDate DESC LIMIT 5"
});

const activity = await tool.salesforce.query({
  soql: "SELECT Subject, CreatedDate, Owner.Name FROM Task WHERE AccountId = :accountId ORDER BY CreatedDate DESC LIMIT 10"
});
```

Do not call `tool.salesforce.updateRecord` from this skill. CRM writes go through Trellis `crm.update` approvals.

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
