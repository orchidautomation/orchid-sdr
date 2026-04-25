import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());

const normalizedSignal = v.object({
  sourceRef: v.string(),
  url: v.string(),
  authorName: v.string(),
  authorTitle: nullableString,
  authorCompany: nullableString,
  companyDomain: nullableString,
  topic: v.string(),
  content: v.string(),
  metadata: v.any(),
  capturedAt: v.number(),
});

export const recordSignal = mutation({
  args: {
    campaignId: v.string(),
    provider: v.string(),
    source: v.string(),
    externalId: v.optional(nullableString),
    localSignalId: v.optional(v.string()),
    signal: normalizedSignal,
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("signals")
      .withIndex("by_provider_source_ref", (q: any) =>
        q.eq("provider", args.provider)
          .eq("source", args.source)
          .eq("sourceRef", args.signal.sourceRef),
      )
      .unique();

    const patch = {
      campaignId: args.campaignId,
      provider: args.provider,
      source: args.source,
      externalId: args.externalId,
      localSignalId: args.localSignalId,
      sourceRef: args.signal.sourceRef,
      url: args.signal.url,
      authorName: args.signal.authorName,
      authorTitle: args.signal.authorTitle,
      authorCompany: args.signal.authorCompany,
      companyDomain: args.signal.companyDomain,
      topic: args.signal.topic,
      content: args.signal.content,
      metadata: args.metadata ?? args.signal.metadata,
      capturedAt: args.signal.capturedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return ctx.db.insert("signals", {
      ...patch,
      createdAt: Date.now(),
    });
  },
});

export const recordWorkflowCheckpoint = mutation({
  args: {
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
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("workflowCheckpoints", {
      ...args,
      createdAt: args.createdAt ?? Date.now(),
    });
  },
});

export const appendAuditEvent = mutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    eventName: v.string(),
    payload: v.any(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("auditEvents", {
      ...args,
      createdAt: args.createdAt ?? Date.now(),
    });
  },
});
