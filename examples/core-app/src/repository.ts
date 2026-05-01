import type { IntakePayload, WorkArtifact, WorkEventRecord, WorkItemRecord, WorkItemStatus } from "./domain/types.js";

export interface WorkItemDetail {
  item: WorkItemRecord;
  events: WorkEventRecord[];
  latestArtifact: {
    kind: string;
    title: string;
    content: string;
    structured: Record<string, unknown> | null;
    updatedAt: number;
  } | null;
}

export interface RuntimeSnapshot {
  items: WorkItemRecord[];
  recentEvents: Array<{
    workItemId: string;
    eventType: string;
    createdAt: number;
  }>;
  totalItems: number;
}

export interface CoreRepository {
  ensureWorkspace(): Promise<{ id: string }>;
  ingestWebhookEvent(payload: IntakePayload): Promise<{ workItemId: string; eventId: string }>;
  listWorkItems(limit?: number): Promise<WorkItemRecord[]>;
  getRuntimeSnapshot(limit?: number): Promise<RuntimeSnapshot>;
  getWorkItemDetail(workItemId: string): Promise<WorkItemDetail | null>;
  getWorkItem(workItemId: string): Promise<WorkItemRecord | null>;
  updateWorkItem(workItemId: string, update: {
    status?: WorkItemStatus;
    stage?: string;
    summary?: string | null;
  }): Promise<void>;
  storeArtifact(workItemId: string, input: {
    kind: string;
    title: string;
    content: string;
    structured?: WorkArtifact | Record<string, unknown>;
  }): Promise<void>;
  appendAuditEvent(entityType: string, entityId: string, eventName: string, payload: Record<string, unknown>): Promise<void>;
}

