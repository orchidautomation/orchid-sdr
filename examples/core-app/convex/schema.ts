import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    key: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  intakeEvents: defineTable({
    id: v.string(),
    source: v.string(),
    externalId: v.optional(v.string()),
    eventType: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_id", ["id"]).index("by_external", ["source", "externalId"]).index("by_updated", ["updatedAt"]),
  workflowRuns: defineTable({
    id: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    workflowName: v.string(),
    status: v.string(),
    stage: v.string(),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_id", ["id"]).index("by_target", ["targetType", "targetId"]).index("by_updated", ["updatedAt"]),
  artifacts: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    kind: v.string(),
    title: v.string(),
    content: v.string(),
    structured: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_entity", ["entityType", "entityId"]).index("by_updated", ["updatedAt"]),
  auditEvents: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    eventName: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_entity", ["entityType", "entityId"]).index("by_created", ["createdAt"]),
});
