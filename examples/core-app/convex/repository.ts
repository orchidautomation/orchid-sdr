import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function now() {
  return Date.now();
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getLatestArtifactForWorkItem(ctx: any, workItemId: string) {
  const artifacts = await ctx.db
    .query("artifacts")
    .withIndex("by_work_item", (q: any) => q.eq("workItemId", workItemId))
    .collect();
  return artifacts.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export const ensureWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("workspaces").withIndex("by_key", (q) => q.eq("key", "default")).unique();
    if (existing) {
      return { id: existing._id };
    }
    const timestamp = now();
    const id = await ctx.db.insert("workspaces", {
      key: "default",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return { id };
  },
});

export const ingestWebhookEvent = mutation({
  args: {
    payload: v.object({
      source: v.string(),
      externalId: v.optional(v.string()),
      type: v.string(),
      title: v.string(),
      body: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    const timestamp = now();
    const existing = args.payload.externalId
      ? await ctx.db.query("workItems").withIndex("by_external", (q: any) =>
          q.eq("source", args.payload.source).eq("externalId", args.payload.externalId),
        ).unique()
      : null;
    const workItemId = existing?.id ?? createId("work");

    if (existing) {
      await ctx.db.patch(existing._id, {
        type: args.payload.type,
        title: args.payload.title,
        body: args.payload.body,
        metadata: args.payload.metadata ?? {},
        status: "new",
        stage: "captured",
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("workItems", {
        id: workItemId,
        type: args.payload.type,
        source: args.payload.source,
        externalId: args.payload.externalId,
        title: args.payload.title,
        body: args.payload.body,
        metadata: args.payload.metadata ?? {},
        status: "new",
        stage: "captured",
        summary: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const eventId = createId("evt");
    await ctx.db.insert("workEvents", {
      id: eventId,
      workItemId,
      eventType: "webhook_captured",
      payload: args.payload,
      createdAt: timestamp,
    });
    return { workItemId, eventId };
  },
});

export const listWorkItems = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const rows = await ctx.db.query("workItems").withIndex("by_updated").order("desc").take(limit);
    return rows.map((row: any) => ({
      ...row,
      metadata: row.metadata ?? {},
    }));
  },
});

export const getRuntimeSnapshot = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const items = await ctx.db.query("workItems").withIndex("by_updated").order("desc").take(limit);
    const recentEvents = await ctx.db.query("workEvents").withIndex("by_created").order("desc").take(limit);
    const totalItems = (await ctx.db.query("workItems").collect()).length;
    return { items, recentEvents, totalItems };
  },
});

export const getWorkItem = query({
  args: { workItemId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("workItems").withIndex("by_id", (q: any) => q.eq("id", args.workItemId)).unique();
  },
});

export const getWorkItemDetail = query({
  args: { workItemId: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.query("workItems").withIndex("by_id", (q: any) => q.eq("id", args.workItemId)).unique();
    if (!item) {
      return null;
    }
    const events = await ctx.db.query("workEvents").withIndex("by_work_item", (q: any) => q.eq("workItemId", args.workItemId)).collect();
    const latestArtifact = await getLatestArtifactForWorkItem(ctx, args.workItemId);
    return {
      item,
      events,
      latestArtifact,
    };
  },
});

export const updateWorkItem = mutation({
  args: {
    workItemId: v.string(),
    update: v.any(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.query("workItems").withIndex("by_id", (q: any) => q.eq("id", args.workItemId)).unique();
    if (!item) {
      throw new Error(`work item not found: ${args.workItemId}`);
    }
    await ctx.db.patch(item._id, {
      ...args.update,
      updatedAt: now(),
    });
  },
});

export const storeArtifact = mutation({
  args: {
    workItemId: v.string(),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const timestamp = now();
    const existing = await getLatestArtifactForWorkItem(ctx, args.workItemId);
    if (existing && existing.kind === args.input.kind) {
      await ctx.db.patch(existing._id, {
        title: args.input.title,
        content: args.input.content,
        structured: args.input.structured,
        updatedAt: timestamp,
      });
      return;
    }

    await ctx.db.insert("artifacts", {
      workItemId: args.workItemId,
      kind: args.input.kind,
      title: args.input.title,
      content: args.input.content,
      structured: args.input.structured,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const appendAuditEvent = mutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    eventName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditEvents", {
      entityType: args.entityType,
      entityId: args.entityId,
      eventName: args.eventName,
      payload: args.payload,
      createdAt: now(),
    });
  },
});
