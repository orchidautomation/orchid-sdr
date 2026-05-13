import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function now() {
  return Date.now();
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getLatestArtifact(ctx: any, entityType: string, entityId: string) {
  const artifacts = await ctx.db
    .query("artifacts")
    .withIndex("by_entity", (q: any) => q.eq("entityType", entityType).eq("entityId", entityId))
    .collect();
  return artifacts.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0] ?? null;
}

async function getWorkflowRunForTarget(ctx: any, targetType: string, targetId: string) {
  const runs = await ctx.db
    .query("workflowRuns")
    .withIndex("by_target", (q: any) => q.eq("targetType", targetType).eq("targetId", targetId))
    .collect();
  return runs.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export const ensureWorkspace = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("workspaces").withIndex("by_key", (q: any) => q.eq("key", "default")).unique();
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
      ? await ctx.db.query("intakeEvents").withIndex("by_external", (q: any) =>
          q.eq("source", args.payload.source).eq("externalId", args.payload.externalId),
        ).unique()
      : null;
    const intakeEventId = existing?.id ?? createId("evt");

    if (existing) {
      await ctx.db.patch(existing._id, {
        eventType: args.payload.type,
        title: args.payload.title,
        body: args.payload.body,
        metadata: args.payload.metadata ?? {},
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("intakeEvents", {
        id: intakeEventId,
        source: args.payload.source,
        externalId: args.payload.externalId,
        eventType: args.payload.type,
        title: args.payload.title,
        body: args.payload.body,
        metadata: args.payload.metadata ?? {},
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const existingRun = await getWorkflowRunForTarget(ctx, "intake_event", intakeEventId);
    const workflowRunId = existingRun?.id ?? createId("run");
    if (existingRun) {
      await ctx.db.patch(existingRun._id, {
        workflowName: "intake_review",
        status: "pending",
        stage: "captured",
        summary: undefined,
        error: undefined,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("workflowRuns", {
        id: workflowRunId,
        targetType: "intake_event",
        targetId: intakeEventId,
        workflowName: "intake_review",
        status: "pending",
        stage: "captured",
        summary: undefined,
        error: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return { intakeEventId, workflowRunId };
  },
});

export const listIntakeEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const rows = await ctx.db.query("intakeEvents").withIndex("by_updated").order("desc").take(limit);
    return rows.map((row: any) => ({ ...row, metadata: row.metadata ?? {} }));
  },
});

export const getRuntimeSnapshot = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    const events = await ctx.db.query("intakeEvents").withIndex("by_updated").order("desc").take(limit);
    const recentAuditEvents = await ctx.db.query("auditEvents").withIndex("by_created").order("desc").take(limit);
    const totalEvents = (await ctx.db.query("intakeEvents").collect()).length;
    return { events, recentAuditEvents, totalEvents };
  },
});

export const getIntakeEvent = query({
  args: { intakeEventId: v.string() },
  handler: async (ctx, args) =>
    await ctx.db.query("intakeEvents").withIndex("by_id", (q: any) => q.eq("id", args.intakeEventId)).unique(),
});

export const getIntakeEventDetail = query({
  args: { intakeEventId: v.string() },
  handler: async (ctx, args) => {
    const intakeEvent = await ctx.db.query("intakeEvents").withIndex("by_id", (q: any) => q.eq("id", args.intakeEventId)).unique();
    if (!intakeEvent) {
      return null;
    }
    const workflowRun = await getWorkflowRunForTarget(ctx, "intake_event", args.intakeEventId);
    const latestArtifact = await getLatestArtifact(ctx, "intake_event", args.intakeEventId);
    const auditEvents = await ctx.db
      .query("auditEvents")
      .withIndex("by_entity", (q: any) => q.eq("entityType", "intake_event").eq("entityId", args.intakeEventId))
      .collect();
    return {
      intakeEvent,
      workflowRun,
      auditEvents: auditEvents.sort((a: any, b: any) => b.createdAt - a.createdAt),
      latestArtifact,
    };
  },
});

export const updateWorkflowRun = mutation({
  args: {
    workflowRunId: v.string(),
    update: v.any(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.query("workflowRuns").withIndex("by_id", (q: any) => q.eq("id", args.workflowRunId)).unique();
    if (!run) {
      throw new Error(`workflow run not found: ${args.workflowRunId}`);
    }
    await ctx.db.patch(run._id, { ...args.update, updatedAt: now() });
  },
});

export const storeArtifact = mutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const timestamp = now();
    const existing = await getLatestArtifact(ctx, args.entityType, args.entityId);
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
      entityType: args.entityType,
      entityId: args.entityId,
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
