import { ConvexHttpClient } from "convex/browser";

import type { IntakePayload, WorkArtifact, WorkEventRecord, WorkItemRecord } from "./domain/types.js";
import type { CoreRepository, RuntimeSnapshot, WorkItemDetail } from "./repository.js";

function mapWorkItem(record: any): WorkItemRecord {
  return {
    id: record.id,
    type: record.type,
    source: record.source,
    externalId: record.externalId ?? null,
    title: record.title,
    body: record.body ?? null,
    metadata: record.metadata ?? {},
    status: record.status,
    stage: record.stage,
    summary: record.summary ?? null,
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

  async listWorkItems(limit = 25) {
    const rows = await (this.client as any).query("repository:listWorkItems", { limit });
    return rows.map(mapWorkItem);
  }

  async getRuntimeSnapshot(limit = 25): Promise<RuntimeSnapshot> {
    const snapshot = await (this.client as any).query("repository:getRuntimeSnapshot", { limit });
    return {
      items: snapshot.items.map(mapWorkItem),
      recentEvents: snapshot.recentEvents.map((event: any) => ({
        workItemId: event.workItemId,
        eventType: event.eventType,
        createdAt: Number(event.createdAt),
      })),
      totalItems: Number(snapshot.totalItems),
    };
  }

  async getWorkItemDetail(workItemId: string): Promise<WorkItemDetail | null> {
    const detail = await (this.client as any).query("repository:getWorkItemDetail", { workItemId });
    if (!detail) {
      return null;
    }

    return {
      item: mapWorkItem(detail.item),
      events: detail.events as WorkEventRecord[],
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

  async getWorkItem(workItemId: string) {
    const item = await (this.client as any).query("repository:getWorkItem", { workItemId });
    return item ? mapWorkItem(item) : null;
  }

  async updateWorkItem(workItemId: string, update: { status?: WorkItemRecord["status"]; stage?: string; summary?: string | null }) {
    await (this.client as any).mutation("repository:updateWorkItem", { workItemId, update });
  }

  async storeArtifact(workItemId: string, input: { kind: string; title: string; content: string; structured?: WorkArtifact | Record<string, unknown> }) {
    await (this.client as any).mutation("repository:storeArtifact", { workItemId, input });
  }

  async appendAuditEvent(entityType: string, entityId: string, eventName: string, payload: Record<string, unknown>) {
    await (this.client as any).mutation("repository:appendAuditEvent", { entityType, entityId, eventName, payload });
  }
}
