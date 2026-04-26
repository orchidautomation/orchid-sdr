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
    if (args.localSignalId) {
      const existingByLocalId = await ctx.db
        .query("signals")
        .withIndex("by_id", (q: any) => q.eq("id", args.localSignalId))
        .unique();

      if (existingByLocalId) {
        await ctx.db.patch(existingByLocalId._id, {
          provider: args.provider,
          externalId: args.externalId ?? null,
          localSignalId: args.localSignalId,
          metadata: args.metadata ?? args.signal.metadata,
          updatedAt: Date.now(),
        });
        return args.localSignalId;
      }
    }

    const existing = await ctx.db
      .query("signals")
      .withIndex("by_provider_source_ref", (q: any) =>
        q.eq("provider", args.provider)
          .eq("source", args.source)
          .eq("sourceRef", args.signal.sourceRef),
      )
      .unique();

    const existingBySourceRef = await ctx.db
      .query("signals")
      .withIndex("by_source_source_ref", (q: any) =>
        q.eq("source", args.source)
          .eq("sourceRef", args.signal.sourceRef),
      )
      .unique();

    const patch = {
      id: args.localSignalId ?? existing?.id ?? existingBySourceRef?.id ?? `sig_${Math.random().toString(36).slice(2, 10)}`,
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
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing.id;
    }

    if (existingBySourceRef) {
      await ctx.db.patch(existingBySourceRef._id, patch);
      return existingBySourceRef.id;
    }

    await ctx.db.insert("signals", {
      ...patch,
      createdAt: Date.now(),
    });
    return patch.id;
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
    const recentForEntity = await ctx.db
      .query("auditEvents")
      .withIndex("by_entity", (q: any) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId),
      )
      .collect();

    const createdAt = args.createdAt ?? Date.now();
    const payloadKey = JSON.stringify(args.payload ?? {});
    const existing = recentForEntity
      .filter((event: any) => event.eventName === args.eventName)
      .find((event: any) =>
        JSON.stringify(event.payload ?? {}) === payloadKey
        && Math.abs((event.createdAt ?? 0) - createdAt) <= 10_000,
      );

    if (existing) {
      return existing.id;
    }

    const auditId = `audit_${Math.random().toString(36).slice(2, 10)}`;
    await ctx.db.insert("auditEvents", {
      id: auditId,
      ...args,
      createdAt,
    });
    return auditId;
  },
});
