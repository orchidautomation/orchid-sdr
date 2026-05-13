import { ConvexHttpClient } from "convex/browser";

import type { IntakeEventRecord, IntakePayload, WorkArtifact, WorkflowRunRecord } from "./domain/types.js";
import type { CoreRepository, IntakeEventDetail, RuntimeSnapshot } from "./repository.js";

function mapIntakeEvent(record: any): IntakeEventRecord {
  return {
    id: record.id,
    source: record.source,
    externalId: record.externalId ?? null,
    eventType: record.eventType,
    title: record.title,
    body: record.body ?? null,
    metadata: record.metadata ?? {},
    createdAt: Number(record.createdAt),
    updatedAt: Number(record.updatedAt),
  };
}

function mapWorkflowRun(record: any): WorkflowRunRecord {
  return {
    id: record.id,
    targetType: record.targetType,
    targetId: record.targetId,
    workflowName: record.workflowName,
    status: record.status,
    stage: record.stage,
    summary: record.summary ?? null,
    error: record.error ?? null,
    createdAt: Number(record.createdAt),
    updatedAt: Number(record.updatedAt),
  };
}

export class ConvexCoreRepository implements CoreRepository {
  constructor(private readonly client: ConvexHttpClient) {}

  async ensureWorkspace() {
    return await (this.client as any).mutation("repository:ensureWorkspace", {});
  }

  async ingestWebhookEvent(payload: IntakePayload) {
    return await (this.client as any).mutation("repository:ingestWebhookEvent", { payload });
  }

  async listIntakeEvents(limit = 25) {
    const rows = await (this.client as any).query("repository:listIntakeEvents", { limit });
    return rows.map(mapIntakeEvent);
  }

  async getRuntimeSnapshot(limit = 25): Promise<RuntimeSnapshot> {
    const snapshot = await (this.client as any).query("repository:getRuntimeSnapshot", { limit });
    return {
      events: snapshot.events.map(mapIntakeEvent),
      recentAuditEvents: snapshot.recentAuditEvents.map((event: any) => ({
        entityType: event.entityType,
        entityId: event.entityId,
        eventName: event.eventName,
        createdAt: Number(event.createdAt),
      })),
      totalEvents: Number(snapshot.totalEvents),
    };
  }

  async getIntakeEventDetail(intakeEventId: string): Promise<IntakeEventDetail | null> {
    const detail = await (this.client as any).query("repository:getIntakeEventDetail", { intakeEventId });
    if (!detail) {
      return null;
    }

    return {
      intakeEvent: mapIntakeEvent(detail.intakeEvent),
      workflowRun: detail.workflowRun ? mapWorkflowRun(detail.workflowRun) : null,
      auditEvents: detail.auditEvents.map((event: any) => ({
        eventName: event.eventName,
        payload: event.payload ?? null,
        createdAt: Number(event.createdAt),
      })),
      latestArtifact: detail.latestArtifact
        ? {
            kind: detail.latestArtifact.kind,
            title: detail.latestArtifact.title,
            content: detail.latestArtifact.content,
            structured: detail.latestArtifact.structured ?? null,
            updatedAt: Number(detail.latestArtifact.updatedAt),
          }
        : null,
    };
  }

  async getIntakeEvent(intakeEventId: string) {
    const intakeEvent = await (this.client as any).query("repository:getIntakeEvent", { intakeEventId });
    return intakeEvent ? mapIntakeEvent(intakeEvent) : null;
  }

  async updateWorkflowRun(workflowRunId: string, update: { status?: WorkflowRunRecord["status"]; stage?: string; summary?: string | null; error?: string | null }) {
    await (this.client as any).mutation("repository:updateWorkflowRun", { workflowRunId, update });
  }

  async storeArtifact(entityType: string, entityId: string, input: { kind: string; title: string; content: string; structured?: WorkArtifact | Record<string, unknown> }) {
    await (this.client as any).mutation("repository:storeArtifact", { entityType, entityId, input });
  }

  async appendAuditEvent(entityType: string, entityId: string, eventName: string, payload: Record<string, unknown>) {
    await (this.client as any).mutation("repository:appendAuditEvent", { entityType, entityId, eventName, payload });
  }
}
