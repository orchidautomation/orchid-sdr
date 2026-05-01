import { z } from "zod";

export const prepRunStatusSchema = z.enum(["pending", "processing", "ready", "paused", "failed"]);
export type PrepRunStatus = z.infer<typeof prepRunStatusSchema>;

export const meetingBookingPayloadSchema = z.object({
  source: z.string().min(1).default("meeting_webhook"),
  externalId: z.string().min(1).optional(),
  meeting: z.object({
    id: z.string().min(1).optional(),
    title: z.string().min(1),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1).optional(),
    organizerEmail: z.string().email().optional(),
    accountName: z.string().optional(),
    notes: z.string().optional(),
    attendees: z.array(
      z.object({
        fullName: z.string().min(1),
        email: z.string().email().optional(),
        company: z.string().optional(),
        role: z.string().optional(),
      }),
    ).default([]),
  }),
});

export type MeetingBookingPayload = z.infer<typeof meetingBookingPayloadSchema>;

export const prepBriefSchema = z.object({
  summary: z.string(),
  accountContext: z.array(z.string()).default([]),
  attendeeHighlights: z.array(z.string()).default([]),
  questionsToAsk: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type PrepBrief = z.infer<typeof prepBriefSchema>;

export interface MeetingRecord {
  id: string;
  source: string;
  externalId: string | null;
  title: string;
  startsAt: string;
  endsAt: string | null;
  organizerEmail: string | null;
  accountName: string | null;
  notes: string | null;
  attioRecordId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AttendeeRecord {
  id: string;
  meetingId: string;
  fullName: string;
  email: string | null;
  company: string | null;
  role: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PrepRunRecord {
  id: string;
  meetingId: string;
  status: PrepRunStatus;
  stage: string;
  summary: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PrepBriefRecord {
  meetingId: string;
  kind: string;
  title: string;
  content: string;
  structured: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface SandboxTurnRequest {
  turnId: string;
  targetId: string;
  stage: string;
  systemPrompt: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

export interface SandboxTurnResponse {
  turnId: string;
  outputText: string;
  transcript: unknown[];
  usage?: Record<string, unknown>;
}
