# Integration Substitution Guide

This example is intentionally useful without connecting a real Salesforce, Zendesk, or warehouse. The skills use placeholder tool contracts so a team can replace the backing implementation later.

## How To Replace A Placeholder

1. Pick the data source.
2. Map the placeholder tool to a real MCP/toolkit/API call.
3. Keep the returned shape stable for the skill.
4. Keep writes approval-gated through Trellis provider actions.

## Salesforce

| Placeholder in skill | Replace with |
|---|---|
| `tool.salesforce.query` | Salesforce Hosted MCP SOQL query, Composio Salesforce query action, or REST API `/query` |
| `tool.salesforce.getRecord` | Salesforce Hosted MCP record read, Composio get-record action, or REST API sObject read |
| `tool.salesforce.updateRecord` | Approved Trellis `crm.update` provider action only |

The Composio Salesforce toolkit is a good fast path when managed OAuth and hosted MCP access are preferred. Keep it behind the same Trellis capability names.

## Zendesk

| Placeholder in skill | Replace with |
|---|---|
| `tool.zendesk.searchTickets` | Zendesk Search API, Composio Zendesk action, or internal Zendesk MCP bridge |
| `tool.zendesk.getTicket` | Zendesk Ticketing API read or Composio ticket read |

Do not persist ticket bodies. Return counts, subjects, tags, status, SLA, CSAT, and inferred themes.

## Usage Warehouse

| Placeholder in skill | Replace with |
|---|---|
| `tool.usage.query` | Snowflake MCP, Postgres MCP, BigQuery adapter, or internal read-only SQL API |

Use aggregate metrics and sanitized replicas when possible. The churn score does not need member-level clinical data.

## Production Checklist

- Read-only scopes for Salesforce, Zendesk, and usage by default.
- Field allowlists for every source.
- Tool outputs redacted before trace persistence.
- CRM writes represented as `crm.update` approvals.
- Composio OAuth scopes and audit logs reviewed before real customer data.
- Output examples validated by CSM/RevOps before launch.
