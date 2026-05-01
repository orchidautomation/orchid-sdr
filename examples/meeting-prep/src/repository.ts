import type { AttendeeRecord, MeetingBookingPayload, MeetingRecord, PrepBrief, PrepBriefRecord, PrepRunRecord, PrepRunStatus } from "./domain/types.js";

export interface MeetingDetail {
  meeting: MeetingRecord;
  attendees: AttendeeRecord[];
  prepRun: PrepRunRecord | null;
  latestBrief: PrepBriefRecord | null;
}

export interface RuntimeSnapshot {
  meetings: MeetingRecord[];
  recentAuditEvents: Array<{
    entityType: string;
    entityId: string;
    eventName: string;
    createdAt: number;
  }>;
  totalMeetings: number;
}

export interface MeetingPrepRepository {
  ensureWorkspace(): Promise<{ id: string }>;
  ingestBooking(payload: MeetingBookingPayload): Promise<{ meetingId: string; prepRunId: string }>;
  listMeetings(limit?: number): Promise<MeetingRecord[]>;
  getRuntimeSnapshot(limit?: number): Promise<RuntimeSnapshot>;
  getMeetingDetail(meetingId: string): Promise<MeetingDetail | null>;
  getMeeting(meetingId: string): Promise<MeetingRecord | null>;
  updatePrepRun(
    prepRunId: string,
    update: {
      status?: PrepRunStatus;
      stage?: string;
      summary?: string | null;
      error?: string | null;
    },
  ): Promise<void>;
  savePrepBrief(meetingId: string, input: { kind: string; title: string; content: string; structured?: PrepBrief | Record<string, unknown> }): Promise<void>;
  appendAuditEvent(entityType: string, entityId: string, eventName: string, payload: Record<string, unknown>): Promise<void>;
}
