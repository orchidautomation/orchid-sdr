import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

export default defineSchema({
  campaigns: defineTable({
    id: v.string(),
    name: v.string(),
    status: v.string(),
    timezone: v.string(),
    quietHoursStart: v.number(),
    quietHoursEnd: v.number(),
    touchCap: v.number(),
    emailConfidenceThreshold: v.number(),
    researchConfidenceThreshold: v.number(),
    sourceLinkedinEnabled: v.boolean(),
    senderEmail: nullableString,
    senderDisplayName: nullableString,
    senderProviderInboxId: nullableString,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_status", ["status"]),

  controlFlags: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  accounts: defineTable({
    id: v.string(),
    domain: v.string(),
    name: v.string(),
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_domain", ["domain"]),

  signals: defineTable({
    id: v.string(),
    campaignId: v.string(),
    source: v.string(),
    sourceRef: v.string(),
    actorRunId: v.optional(nullableString),
    datasetId: v.optional(nullableString),
    url: v.string(),
    authorName: v.string(),
    authorTitle: nullableString,
    authorCompany: nullableString,
    companyDomain: nullableString,
    twitterUrl: nullableString,
    topic: v.string(),
    content: v.string(),
    metadata: v.any(),
    capturedAt: v.number(),
    provider: v.optional(v.string()),
    externalId: v.optional(nullableString),
    localSignalId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_id", ["id"])
    .index("by_campaign", ["campaignId"])
    .index("by_source_source_ref", ["source", "sourceRef"])
    .index("by_provider_source_ref", ["provider", "source", "sourceRef"])
    .index("by_captured_at", ["capturedAt"]),

  prospects: defineTable({
    id: v.string(),
    campaignId: v.string(),
    accountId: nullableString,
    fullName: v.string(),
    firstName: v.string(),
    title: nullableString,
    company: nullableString,
    companyDomain: nullableString,
    linkedinUrl: nullableString,
    twitterUrl: nullableString,
    attioCompanyRecordId: nullableString,
    attioPersonRecordId: nullableString,
    attioListEntryId: nullableString,
    sourceSignalId: nullableString,
    qualificationReason: nullableString,
    qualification: v.optional(v.any()),
    metadata: v.any(),
    isQualified: v.boolean(),
    qualifiedAt: v.optional(nullableNumber),
    status: v.string(),
    stage: v.string(),
    lastReplyClass: nullableString,
    pausedReason: nullableString,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_campaign", ["campaignId"])
    .index("by_source_signal", ["sourceSignalId"])
    .index("by_campaign_linkedin", ["campaignId", "linkedinUrl"])
    .index("by_campaign_twitter", ["campaignId", "twitterUrl"])
    .index("by_campaign_name_domain", ["campaignId", "fullName", "companyDomain"])
    .index("by_updated_at", ["updatedAt"])
    .index("by_status", ["status"])
    .index("by_company_domain", ["companyDomain"]),

  threads: defineTable({
    id: v.string(),
    prospectId: v.string(),
    campaignId: v.string(),
    stage: v.string(),
    status: v.string(),
    lastReplyClass: nullableString,
    pausedReason: nullableString,
    providerThreadId: nullableString,
    providerInboxId: nullableString,
    nextFollowUpAt: nullableString,
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_prospect", ["prospectId"])
    .index("by_provider_thread", ["providerThreadId"])
    .index("by_campaign_status", ["campaignId", "status"])
    .index("by_updated_at", ["updatedAt"]),

  contactMethods: defineTable({
    id: v.string(),
    prospectId: v.string(),
    kind: v.string(),
    value: v.string(),
    confidence: v.number(),
    source: v.string(),
    verified: v.boolean(),
    metadata: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_prospect_kind", ["prospectId", "kind"])
    .index("by_prospect_kind_value", ["prospectId", "kind", "value"]),

  researchBriefs: defineTable({
    id: v.string(),
    prospectId: v.string(),
    campaignId: v.string(),
    summary: v.string(),
    evidence: v.any(),
    confidence: v.number(),
    metadata: v.any(),
    createdAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_prospect", ["prospectId"])
    .index("by_created_at", ["createdAt"]),

  messages: defineTable({
    id: v.string(),
    threadId: v.string(),
    providerMessageId: nullableString,
    direction: v.string(),
    kind: v.string(),
    subject: nullableString,
    bodyText: v.string(),
    bodyHtml: nullableString,
    classification: nullableString,
    metadata: v.any(),
    createdAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_thread", ["threadId"])
    .index("by_thread_direction", ["threadId", "direction"])
    .index("by_provider_message", ["providerMessageId"])
    .index("by_created_at", ["createdAt"]),

  providerRuns: defineTable({
    id: v.string(),
    provider: v.string(),
    kind: v.string(),
    externalId: nullableString,
    status: v.string(),
    requestPayload: v.any(),
    responsePayload: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_created_at", ["createdAt"])
    .index("by_provider", ["provider"]),

  workflowCheckpoints: defineTable({
    workflowName: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    step: v.string(),
    status: v.string(),
    runtimeProvider: v.optional(v.string()),
    actorId: v.optional(v.string()),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_workflow_status", ["workflowName", "status"])
    .index("by_created_at", ["createdAt"]),

  agentThreads: defineTable({
    campaignId: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    convexThreadId: v.string(),
    agentName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_campaign", ["campaignId"]),

  auditEvents: defineTable({
    id: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    eventName: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_created_at", ["createdAt"]),

  handoffs: defineTable({
    id: v.string(),
    threadId: v.string(),
    target: v.string(),
    payload: v.any(),
    status: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_id", ["id"])
    .index("by_thread", ["threadId"]),
});
