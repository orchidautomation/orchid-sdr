import { trellis, type TrellisProviderDefinition } from "@trellis/gtm";
import salesforceMap from "./salesforce.map";
import usageWarehouseMap from "./usage-warehouse.map";
import zendeskMap from "./zendesk.map";

export function salesforceCrm(): TrellisProviderDefinition {
  return trellis.provider({
    id: "salesforce",
    kind: "crm",
    displayName: "Salesforce",
    config: {
      map: salesforceMap,
      preferredAccess: "salesforce-hosted-mcp",
    },
    env: [
      { name: "SALESFORCE_MCP_URL", description: "Salesforce Hosted MCP server URL for read/query and approved CRM updates." },
      { name: "SALESFORCE_CLIENT_ID", description: "OAuth client id used by the MCP client or gateway." },
    ],
    capabilities: ["crm.readAccount", "crm.query", "crm.update"],
  });
}

export function zendeskSupport(): TrellisProviderDefinition {
  return trellis.provider({
    id: "zendesk",
    kind: "source",
    displayName: "Zendesk",
    config: {
      map: zendeskMap,
      preferredAccess: "zendesk-rest-api-or-reviewed-mcp-bridge",
    },
    env: [
      { name: "ZENDESK_SUBDOMAIN", description: "Zendesk subdomain for official Ticketing API access." },
      { name: "ZENDESK_API_TOKEN", description: "Zendesk API token scoped to ticket reads for the churn agent." },
      { name: "ZENDESK_EMAIL", description: "Zendesk API user email." },
    ],
    capabilities: ["support.ticket.search", "support.ticket.read", "support.csat.read"],
  });
}

export function usageWarehouse(): TrellisProviderDefinition {
  return trellis.provider({
    id: "usage-warehouse",
    kind: "source",
    displayName: "Usage warehouse",
    config: {
      map: usageWarehouseMap,
      preferredAccess: "snowflake-managed-mcp-or-readonly-postgres-mcp",
    },
    env: [
      { name: "SNOWFLAKE_MCP_URL", description: "Snowflake-managed MCP server URL when usage lives in Snowflake." },
      { name: "DATABASE_URL", description: "Read-only Postgres URL for reference MCP server fallback." },
    ],
    capabilities: ["usage.query", "usage.registration.read", "usage.utilization.read"],
  });
}
