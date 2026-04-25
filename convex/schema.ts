import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  signals: defineTable({
    campaignId: v.string(),
    provider: v.string(),
    source: v.string(),
    externalId: v.optional(v.union(v.string(), v.null())),
    localSignalId: v.optional(v.string()),
    sourceRef: v.string(),
    url: v.string(),
    authorName: v.string(),
    authorTitle: v.union(v.string(), v.null()),
    authorCompany: v.union(v.string(), v.null()),
    companyDomain: v.union(v.string(), v.null()),
    topic: v.string(),
    content: v.string(),
    metadata: v.any(),
    capturedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_provider_source_ref", ["provider", "source", "sourceRef"])
    .index("by_captured_at", ["capturedAt"]),

  prospects: defineTable({
    campaignId: v.string(),
    sourceSignalId: v.optional(v.string()),
    fullName: v.string(),
    title: v.union(v.string(), v.null()),
    company: v.union(v.string(), v.null()),
    companyDomain: v.union(v.string(), v.null()),
    status: v.string(),
    stage: v.string(),
    qualification: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_company_domain", ["companyDomain"])
    .index("by_status", ["status"]),

  threads: defineTable({
    campaignId: v.string(),
    prospectId: v.string(),
    stage: v.string(),
    status: v.string(),
    providerThreadId: v.optional(v.union(v.string(), v.null())),
    lastReplyClass: v.optional(v.union(v.string(), v.null())),
    updatedAt: v.number(),
  })
    .index("by_prospect", ["prospectId"])
    .index("by_campaign_status", ["campaignId", "status"])
    .index("by_updated_at", ["updatedAt"]),

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
    entityType: v.string(),
    entityId: v.string(),
    eventName: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_created_at", ["createdAt"]),
});
