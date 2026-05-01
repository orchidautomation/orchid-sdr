import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaces: defineTable({
    key: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  workItems: defineTable({
    id: v.string(),
    type: v.string(),
    source: v.string(),
    externalId: v.optional(v.string()),
    title: v.string(),
    body: v.optional(v.string()),
    metadata: v.optional(v.any()),
    status: v.string(),
    stage: v.string(),
    summary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_id", ["id"]).index("by_external", ["source", "externalId"]).index("by_updated", ["updatedAt"]),
  workEvents: defineTable({
    id: v.string(),
    workItemId: v.string(),
    eventType: v.string(),
    payload: v.any(),
    createdAt: v.number(),
  }).index("by_work_item", ["workItemId"]).index("by_created", ["createdAt"]),
  artifacts: defineTable({
    workItemId: v.string(),
    kind: v.string(),
    title: v.string(),
    content: v.string(),
    structured: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_work_item", ["workItemId"]).index("by_updated", ["updatedAt"]),
  auditEvents: defineTable({
    entityType: v.string(),
    entityId: v.string(),
    eventName: v.string(),
    payload: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_entity", ["entityType", "entityId"]).index("by_created", ["createdAt"]),
});

