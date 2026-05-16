export default {
  mode: "optional-managed-toolkit",
  salesforce: {
    toolkit: "salesforce",
    docs: "https://composio.dev/toolkits/salesforce",
    mcpServerEnv: "COMPOSIO_SALESFORCE_MCP_URL",
    authEnv: "COMPOSIO_API_KEY",
    placeholders: {
      queryAccount: "tool.salesforce.query",
      readRecord: "tool.salesforce.getRecord",
      listRelatedRecords: "tool.salesforce.query",
      updateRecord: "tool.salesforce.updateRecord",
    },
    approvalGates: {
      updateRecord: "crm.update",
    },
  },
  zendesk: {
    toolkit: "zendesk",
    mcpServerEnv: "COMPOSIO_ZENDESK_MCP_URL",
    authEnv: "COMPOSIO_API_KEY",
    placeholders: {
      searchTickets: "tool.zendesk.searchTickets",
      readTicket: "tool.zendesk.getTicket",
      listOrganizationTickets: "tool.zendesk.searchTickets",
    },
  },
};
