export default {
  organizationLookup: {
    byName: "type:organization name:\"${accountName}\"",
    byExternalId: "external_id:${accountId}",
  },
  ticketSearches: {
    recentTickets: "type:ticket organization:\"${accountName}\" created>90days_ago",
    openAging: "type:ticket organization:\"${accountName}\" status<solved updated<14days_ago",
    execEscalations: "type:ticket organization:\"${accountName}\" tags:exec_escalation created>90days_ago",
    urgentTickets: "type:ticket organization:\"${accountName}\" priority:urgent created>30days_ago",
  },
  fields: {
    satisfactionRating: "satisfaction_rating",
    priority: "priority",
    status: "status",
    tags: "tags",
    requester: "requester_id",
    organization: "organization_id",
  },
};
