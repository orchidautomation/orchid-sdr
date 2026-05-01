import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function now() {
  return Date.now();
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getPrepRun(ctx: any, meetingId: string) {
  const rows = await ctx.db.query("prepRuns").withIndex("by_meeting", (q: any) => q.eq("meetingId", meetingId)).collect();
  return rows.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0] ?? null;
}

async function getLatestBrief(ctx: any, meetingId: string) {
  const rows = await ctx.db.query("prepBriefs").withIndex("by_meeting", (q: any) => q.eq("meetingId", meetingId)).collect();
  return rows.sort((a: any, b: any) => b.updatedAt - a.updatedAt)[0] ?? null;
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

export const ingestBooking = mutation({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const { payload } = args;
    const timestamp = now();
    const externalMeetingId = payload.meeting.id ?? payload.externalId;
    const existing = externalMeetingId
      ? await ctx.db.query("meetings").withIndex("by_external", (q: any) => q.eq("source", payload.source).eq("externalId", externalMeetingId)).unique()
      : null;
    const meetingId = existing?.id ?? createId("mtg");

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: payload.meeting.title,
        startsAt: payload.meeting.startsAt,
        endsAt: payload.meeting.endsAt,
        organizerEmail: payload.meeting.organizerEmail,
        accountName: payload.meeting.accountName,
        notes: payload.meeting.notes,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("meetings", {
        id: meetingId,
        source: payload.source,
        externalId: externalMeetingId,
        title: payload.meeting.title,
        startsAt: payload.meeting.startsAt,
        endsAt: payload.meeting.endsAt,
        organizerEmail: payload.meeting.organizerEmail,
        accountName: payload.meeting.accountName,
        notes: payload.meeting.notes,
        attioRecordId: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const currentAttendees = await ctx.db.query("attendees").withIndex("by_meeting", (q: any) => q.eq("meetingId", meetingId)).collect();
    for (const attendee of currentAttendees) {
      await ctx.db.delete(attendee._id);
    }
    for (const attendee of payload.meeting.attendees ?? []) {
      await ctx.db.insert("attendees", {
        id: createId("att"),
        meetingId,
        fullName: attendee.fullName,
        email: attendee.email,
        company: attendee.company,
        role: attendee.role,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const existingRun = await getPrepRun(ctx, meetingId);
    const prepRunId = existingRun?.id ?? createId("prep");
    if (existingRun) {
      await ctx.db.patch(existingRun._id, {
        status: "pending",
        stage: "captured",
        summary: undefined,
        error: undefined,
        updatedAt: timestamp,
      });
    } else {
      await ctx.db.insert("prepRuns", {
        id: prepRunId,
        meetingId,
        status: "pending",
        stage: "captured",
        summary: undefined,
        error: undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return { meetingId, prepRunId };
  },
});

export const listMeetings = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("meetings").withIndex("by_updated").order("desc").take(args.limit ?? 25);
    return rows;
  },
});

export const getRuntimeSnapshot = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const meetings = await ctx.db.query("meetings").withIndex("by_updated").order("desc").take(args.limit ?? 25);
    const recentAuditEvents = await ctx.db.query("auditEvents").withIndex("by_created").order("desc").take(args.limit ?? 25);
    const totalMeetings = (await ctx.db.query("meetings").collect()).length;
    return { meetings, recentAuditEvents, totalMeetings };
  },
});

export const getMeeting = query({
  args: { meetingId: v.string() },
  handler: async (ctx, args) => await ctx.db.query("meetings").withIndex("by_id", (q: any) => q.eq("id", args.meetingId)).unique(),
});

export const getMeetingDetail = query({
  args: { meetingId: v.string() },
  handler: async (ctx, args) => {
    const meeting = await ctx.db.query("meetings").withIndex("by_id", (q: any) => q.eq("id", args.meetingId)).unique();
    if (!meeting) {
      return null;
    }
    const attendees = await ctx.db.query("attendees").withIndex("by_meeting", (q: any) => q.eq("meetingId", args.meetingId)).collect();
    const prepRun = await getPrepRun(ctx, args.meetingId);
    const latestBrief = await getLatestBrief(ctx, args.meetingId);
    return { meeting, attendees, prepRun, latestBrief };
  },
});

export const updatePrepRun = mutation({
  args: {
    prepRunId: v.string(),
    update: v.any(),
  },
  handler: async (ctx, args) => {
    const prepRun = await ctx.db.query("prepRuns").withIndex("by_id", (q: any) => q.eq("id", args.prepRunId)).unique();
    if (!prepRun) {
      throw new Error(`prep run not found: ${args.prepRunId}`);
    }
    await ctx.db.patch(prepRun._id, {
      ...args.update,
      updatedAt: now(),
    });
  },
});

export const savePrepBrief = mutation({
  args: {
    meetingId: v.string(),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const timestamp = now();
    const existing = await getLatestBrief(ctx, args.meetingId);
    if (existing && existing.kind === args.input.kind) {
      await ctx.db.patch(existing._id, {
        title: args.input.title,
        content: args.input.content,
        structured: args.input.structured,
        updatedAt: timestamp,
      });
      return;
    }
    await ctx.db.insert("prepBriefs", {
      meetingId: args.meetingId,
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
