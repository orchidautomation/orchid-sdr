import { z } from "zod";

import { normalizedSignalSchema } from "./signals.js";

export const stateEntityTypeSchema = z.enum([
  "campaign",
  "providerRun",
  "signal",
  "prospect",
  "thread",
  "sandboxTurn",
  "handoff",
]);

export const stateWorkflowStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
]);

export const stateSignalRecordInputSchema = z.object({
  campaignId: z.string().min(1),
  provider: z.string().min(1),
  source: z.string().min(1),
  externalId: z.string().nullable().optional(),
  localSignalId: z.string().min(1).optional(),
  signal: normalizedSignalSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const stateSignalRecordResultSchema = z.object({
  providerId: z.string().min(1),
  stateSignalId: z.string().nullable(),
  stored: z.boolean(),
});

export const stateWorkflowCheckpointInputSchema = z.object({
  workflowName: z.string().min(1),
  entityType: stateEntityTypeSchema,
  entityId: z.string().min(1),
  step: z.string().min(1),
  status: stateWorkflowStatusSchema,
  runtimeProvider: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.number().finite().optional(),
});

export const stateWorkflowCheckpointResultSchema = z.object({
  providerId: z.string().min(1),
  checkpointId: z.string().nullable(),
  stored: z.boolean(),
});

export const stateAuditEventInputSchema = z.object({
  entityType: stateEntityTypeSchema,
  entityId: z.string().min(1),
  eventName: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.number().finite().optional(),
});

export const stateAuditEventResultSchema = z.object({
  providerId: z.string().min(1),
  auditEventId: z.string().nullable(),
  stored: z.boolean(),
});

export type StateEntityType = z.infer<typeof stateEntityTypeSchema>;
export type StateWorkflowStatus = z.infer<typeof stateWorkflowStatusSchema>;
export type StateSignalRecordInput = z.infer<typeof stateSignalRecordInputSchema>;
export type StateSignalRecordResult = z.infer<typeof stateSignalRecordResultSchema>;
export type StateWorkflowCheckpointInput = z.infer<typeof stateWorkflowCheckpointInputSchema>;
export type StateWorkflowCheckpointResult = z.infer<typeof stateWorkflowCheckpointResultSchema>;
export type StateAuditEventInput = z.infer<typeof stateAuditEventInputSchema>;
export type StateAuditEventResult = z.infer<typeof stateAuditEventResultSchema>;

export interface StatePlaneProvider {
  providerId: string;
  recordSignal(input: StateSignalRecordInput): Promise<StateSignalRecordResult>;
  recordWorkflowCheckpoint(input: StateWorkflowCheckpointInput): Promise<StateWorkflowCheckpointResult>;
  appendAuditEvent(input: StateAuditEventInput): Promise<StateAuditEventResult>;
}

export const convexStateTableBlueprint = [
  {
    name: "signals",
    owner: "Convex",
    purpose: "Canonical normalized inbound signals and source provenance.",
    indexes: ["by_campaign", "by_provider_source_ref", "by_captured_at"],
  },
  {
    name: "prospects",
    owner: "Convex",
    purpose: "Canonical people and company context produced from signals.",
    indexes: ["by_campaign", "by_company_domain", "by_status"],
  },
  {
    name: "threads",
    owner: "Convex",
    purpose: "Agent and outreach thread state, including lifecycle stage and message refs.",
    indexes: ["by_prospect", "by_campaign_status", "by_updated_at"],
  },
  {
    name: "workflowCheckpoints",
    owner: "Convex",
    purpose: "Durable checkpoints written by Rivet actors and other runtimes.",
    indexes: ["by_entity", "by_workflow_status", "by_created_at"],
  },
  {
    name: "agentThreads",
    owner: "Convex",
    purpose: "Convex Agent thread/message ownership for SDR agent memory.",
    indexes: ["by_entity", "by_campaign"],
  },
  {
    name: "auditEvents",
    owner: "Convex",
    purpose: "Append-only product-visible audit trail.",
    indexes: ["by_entity", "by_created_at"],
  },
] as const;
