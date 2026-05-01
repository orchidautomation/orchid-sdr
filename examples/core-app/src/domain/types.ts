import { z } from "zod";

export const workItemStatusSchema = z.enum(["new", "processing", "ready", "paused", "failed"]);
export type WorkItemStatus = z.infer<typeof workItemStatusSchema>;

export const intakePayloadSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().min(1).optional(),
  type: z.string().min(1).default("generic"),
  title: z.string().min(1),
  body: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type IntakePayload = z.infer<typeof intakePayloadSchema>;

export const workArtifactSchema = z.object({
  summary: z.string(),
  keyFacts: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type WorkArtifact = z.infer<typeof workArtifactSchema>;

export interface WorkItemRecord {
  id: string;
  type: string;
  source: string;
  externalId: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  status: WorkItemStatus;
  stage: string;
  summary: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface WorkEventRecord {
  id: string;
  workItemId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export interface SandboxTurnRequest {
  turnId: string;
  workItemId: string;
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

