import { ConvexHttpClient } from "convex/browser";

import type { AttendeeRecord, MeetingBookingPayload, MeetingRecord, PrepBriefRecord, PrepRunRecord } from "./domain/types.js";
import type { MeetingDetail, MeetingPrepRepository, RuntimeSnapshot } from "./repository.js";

function mapMeeting(record: any): MeetingRecord {
  return {
    id: record.id,
    source: record.source,
    externalId: record.externalId ?? null,
    title: record.title,
    startsAt: record.startsAt,
    endsAt: record.endsAt ?? null,
    organizerEmail: record.organizerEmail ?? null,
    accountName: record.accountName ?? null,
    notes: record.notes ?? null,
    attioRecordId: record.attioRecordId ?? null,
    createdAt: Number(record.createdAt),
    updatedAt: Number(record.updatedAt),
  };
}

function mapAttendee(record: any): AttendeeRecord {
  return {
    id: record.id,
    meetingId: record.meetingId,
    fullName: record.fullName,
    email: record.email ?? null,
    company: record.company ?? null,
    role: record.role ?? null,
    createdAt: Number(record.createdAt),
    updatedAt: Number(record.updatedAt),
  };
}

function mapPrepRun(record: any): PrepRunRecord {
  return {
    id: record.id,
    meetingId: record.meetingId,
    status: record.status,
    stage: record.stage,
    summary: record.summary ?? null,
    error: record.error ?? null,
    createdAt: Number(record.createdAt),
    updatedAt: Number(record.updatedAt),
  };
}

function mapPrepBrief(record: any): PrepBriefRecord {
  return {
    meetingId: record.meetingId,
    kind: record.kind,
    title: record.title,
    content: record.content,
    structured: record.structured ?? null,
    createdAt: Number(record.createdAt),
    updatedAt: Number(record.updatedAt),
  };
}

export class ConvexMeetingPrepRepository implements MeetingPrepRepository {
  constructor(private readonly client: ConvexHttpClient) {}

  async ensureWorkspace() {
    return await (this.client as any).mutation("repository:ensureWorkspace", {});
  }

  async ingestBooking(payload: MeetingBookingPayload) {
    return await (this.client as any).mutation("repository:ingestBooking", { payload });
  }

  async listMeetings(limit = 25) {
    const rows = await (this.client as any).query("repository:listMeetings", { limit });
    return rows.map(mapMeeting);
  }

  async getRuntimeSnapshot(limit = 25): Promise<RuntimeSnapshot> {
    const snapshot = await (this.client as any).query("repository:getRuntimeSnapshot", { limit });
    return {
      meetings: snapshot.meetings.map(mapMeeting),
      recentAuditEvents: snapshot.recentAuditEvents.map((event: any) => ({
        entityType: event.entityType,
        entityId: event.entityId,
        eventName: event.eventName,
        createdAt: Number(event.createdAt),
      })),
      totalMeetings: Number(snapshot.totalMeetings),
    };
  }

  async getMeetingDetail(meetingId: string): Promise<MeetingDetail | null> {
    const detail = await (this.client as any).query("repository:getMeetingDetail", { meetingId });
    if (!detail) {
      return null;
    }
    return {
      meeting: mapMeeting(detail.meeting),
      attendees: detail.attendees.map(mapAttendee),
      prepRun: detail.prepRun ? mapPrepRun(detail.prepRun) : null,
      latestBrief: detail.latestBrief ? mapPrepBrief(detail.latestBrief) : null,
    };
  }

  async getMeeting(meetingId: string) {
    const meeting = await (this.client as any).query("repository:getMeeting", { meetingId });
    return meeting ? mapMeeting(meeting) : null;
  }

  async updatePrepRun(prepRunId: string, update: { status?: PrepRunRecord["status"]; stage?: string; summary?: string | null; error?: string | null }) {
    await (this.client as any).mutation("repository:updatePrepRun", { prepRunId, update });
  }

  async savePrepBrief(meetingId: string, input: { kind: string; title: string; content: string; structured?: Record<string, unknown> }) {
    await (this.client as any).mutation("repository:savePrepBrief", { meetingId, input });
  }

  async appendAuditEvent(entityType: string, entityId: string, eventName: string, payload: Record<string, unknown>) {
    await (this.client as any).mutation("repository:appendAuditEvent", { entityType, entityId, eventName, payload });
  }
}
