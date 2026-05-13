import { z } from "zod";

export const workflowRunStatusSchema = z.enum(["pending", "processing", "ready", "paused", "failed"]);
export type WorkflowRunStatus = z.infer<typeof workflowRunStatusSchema>;

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

export interface IntakeEventRecord {
  id: string;
  source: string;
  externalId: string | null;
  eventType: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowRunRecord {
  id: string;
  targetType: string;
  targetId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  stage: string;
  summary: string | null;
  error: string | null;
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
