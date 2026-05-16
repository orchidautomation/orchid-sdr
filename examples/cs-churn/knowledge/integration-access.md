# Integration Access Reference

This agent should prefer reputable, least-privilege data access over ad hoc screen scraping.

## Salesforce

Preferred path: Salesforce Hosted MCP Servers.

- Use first-party Salesforce MCP where available.
- Start read-only with SOQL query access for Account, Opportunity, Task, Contact, and Case fields needed by `churn-salesforce`.
- Add `crm.update` only after approvals are wired. Trellis should queue and gate the update, not let the skill write directly.
- Source: https://developer.salesforce.com/docs/platform/hosted-mcp-servers/guide/hosted-mcp-servers-overview.html

Fallback path: Salesforce REST API through a small Trellis provider adapter with OAuth and field-level allowlists.

## Zendesk

Preferred path today: official Zendesk Ticketing API.

- Zendesk has strong official APIs for organization lookup, ticket search, ticket reads, satisfaction ratings, and tags.
- A third-party or internal MCP bridge can wrap those APIs, but it should be reviewed as infrastructure, not treated as first-party by default.
- Composio toolkits may be a practical managed option for Zendesk access if OAuth scopes, logging, data retention, and enterprise controls pass review.
- Start with read-only scopes for ticket search and metadata.
- Never persist or quote full ticket bodies into Trellis traces or final briefs.
- Source: https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/

## Usage Data

Preferred path depends on warehouse:

- Snowflake: use Snowflake's managed MCP/server path when the usage warehouse lives there.
- Postgres: use the reference Postgres MCP server or an internal read-only SQL provider against a sanitized replica.
- BigQuery: use an internal least-privilege query provider until a reviewed MCP path is approved.

Usage access should be read-only. The agent only needs aggregates for registration, utilization, activity trend, admin cadence, and modality mix.

Sources:

- https://docs.snowflake.com/en/developer-guide/snowflake-mcp
- https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres

## Managed Toolkit Option: Composio

Composio can be useful when a team wants one managed integration layer across SaaS apps instead of maintaining separate MCP/API adapters. Treat it as a connector provider, not as the Trellis runtime:

- Good fit: fast proof-of-concept access to Salesforce, Zendesk, Slack, Gmail, Linear, and other SaaS tools.
- Review required: OAuth scopes, tenant isolation, audit logs, token storage, data retention, and whether raw ticket/customer content leaves the approved boundary.
- Trellis rule: Composio tools should map into the same provider capabilities, such as `crm.readAccount`, `support.ticket.search`, or `crm.update`; they should not bypass Trellis approvals or traces.
- For write-capable tools, keep Trellis `crm.update` approval-gated.
- Source: https://docs.composio.dev/docs/mcp

## Trellis Rule

MCPs expose data capabilities. Trellis still owns:

- role-aware access
- skill orchestration
- redacted traces
- approval gates
- provider action queueing
- final state
