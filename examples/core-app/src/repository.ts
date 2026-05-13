import type { IntakeEventRecord, IntakePayload, WorkArtifact, WorkflowRunRecord, WorkflowRunStatus } from "./domain/types.js";

export interface IntakeEventDetail {
  intakeEvent: IntakeEventRecord;
  workflowRun: WorkflowRunRecord | null;
  auditEvents: Array<{
    eventName: string;
    payload: Record<string, unknown> | null;
    createdAt: number;
  }>;
  latestArtifact: {
    kind: string;
    title: string;
    content: string;
    structured: Record<string, unknown> | null;
    updatedAt: number;
  } | null;
}

export interface RuntimeSnapshot {
  events: IntakeEventRecord[];
  recentAuditEvents: Array<{
    entityType: string;
    entityId: string;
    eventName: string;
    createdAt: number;
  }>;
  totalEvents: number;
}

export interface CoreRepository {
  ensureWorkspace(): Promise<{ id: string }>;
  ingestWebhookEvent(payload: IntakePayload): Promise<{ intakeEventId: string; workflowRunId: string }>;
  listIntakeEvents(limit?: number): Promise<IntakeEventRecord[]>;
  getRuntimeSnapshot(limit?: number): Promise<RuntimeSnapshot>;
  getIntakeEventDetail(intakeEventId: string): Promise<IntakeEventDetail | null>;
  getIntakeEvent(intakeEventId: string): Promise<IntakeEventRecord | null>;
  updateWorkflowRun(
    workflowRunId: string,
    update: {
      status?: WorkflowRunStatus;
      stage?: string;
      summary?: string | null;
      error?: string | null;
    },
  ): Promise<void>;
  storeArtifact(
    entityType: string,
    entityId: string,
    input: {
      kind: string;
      title: string;
      content: string;
      structured?: WorkArtifact | Record<string, unknown>;
    },
  ): Promise<void>;
  appendAuditEvent(entityType: string, entityId: string, eventName: string, payload: Record<string, unknown>): Promise<void>;
}
