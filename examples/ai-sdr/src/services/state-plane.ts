import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  StateAuditEventInput,
  StateAuditEventResult,
  StatePlaneProvider,
  StateSignalRecordInput,
  StateSignalRecordResult,
  StateWorkflowCheckpointInput,
  StateWorkflowCheckpointResult,
} from "@ai-sdr/framework/state";
import {
  stateAuditEventInputSchema,
  stateSignalRecordInputSchema,
  stateWorkflowCheckpointInputSchema,
} from "@ai-sdr/framework/state";

const DISABLED_PROVIDER_ID = "disabled";
const CONVEX_PROVIDER_ID = "convex";

const convexMutations = {
  recordSignal: makeFunctionReference<"mutation">("aiSdrState:recordSignal"),
  recordWorkflowCheckpoint: makeFunctionReference<"mutation">("aiSdrState:recordWorkflowCheckpoint"),
  appendAuditEvent: makeFunctionReference<"mutation">("aiSdrState:appendAuditEvent"),
};

export class DisabledStatePlaneProvider implements StatePlaneProvider {
  readonly providerId = DISABLED_PROVIDER_ID;

  async recordSignal(_input: StateSignalRecordInput): Promise<StateSignalRecordResult> {
    return {
      providerId: this.providerId,
      stateSignalId: null,
      stored: false,
    };
  }

  async recordWorkflowCheckpoint(
    _input: StateWorkflowCheckpointInput,
  ): Promise<StateWorkflowCheckpointResult> {
    return {
      providerId: this.providerId,
      checkpointId: null,
      stored: false,
    };
  }

  async appendAuditEvent(_input: StateAuditEventInput): Promise<StateAuditEventResult> {
    return {
      providerId: this.providerId,
      auditEventId: null,
      stored: false,
    };
  }
}

export class ConvexStatePlaneProvider implements StatePlaneProvider {
  readonly providerId = CONVEX_PROVIDER_ID;
  private readonly client: ConvexHttpClient;

  constructor(convexUrl: string) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  async recordSignal(input: StateSignalRecordInput): Promise<StateSignalRecordResult> {
    const parsed = stateSignalRecordInputSchema.parse(input);
    const stateSignalId = await this.client.mutation(
      convexMutations.recordSignal,
      stripUndefinedDeep(parsed),
    );

    return {
      providerId: this.providerId,
      stateSignalId: String(stateSignalId),
      stored: true,
    };
  }

  async recordWorkflowCheckpoint(
    input: StateWorkflowCheckpointInput,
  ): Promise<StateWorkflowCheckpointResult> {
    const parsed = stateWorkflowCheckpointInputSchema.parse(input);
    const checkpointId = await this.client.mutation(
      convexMutations.recordWorkflowCheckpoint,
      stripUndefinedDeep(parsed),
    );

    return {
      providerId: this.providerId,
      checkpointId: String(checkpointId),
      stored: true,
    };
  }

  async appendAuditEvent(input: StateAuditEventInput): Promise<StateAuditEventResult> {
    const parsed = stateAuditEventInputSchema.parse(input);
    const auditEventId = await this.client.mutation(
      convexMutations.appendAuditEvent,
      stripUndefinedDeep(parsed),
    );

    return {
      providerId: this.providerId,
      auditEventId: String(auditEventId),
      stored: true,
    };
  }
}

export function createDefaultStatePlaneProvider(
  input: {
    convexUrl?: string;
  } = {},
): StatePlaneProvider {
  if (input.convexUrl) {
    return new ConvexStatePlaneProvider(input.convexUrl);
  }

  return new DisabledStatePlaneProvider();
}

export function createConfiguredStatePlaneProvider(
  input: {
    providerId?: string | null;
    convexUrl?: string;
  } = {},
): StatePlaneProvider {
  if (!input.providerId || input.providerId === DISABLED_PROVIDER_ID) {
    return new DisabledStatePlaneProvider();
  }

  if (input.providerId === CONVEX_PROVIDER_ID) {
    if (!input.convexUrl) {
      return new DisabledStatePlaneProvider();
    }
    return new ConvexStatePlaneProvider(input.convexUrl);
  }

  throw new Error(`unsupported configured state provider: ${input.providerId}`);
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefinedDeep(item)]),
    ) as T;
  }

  return value;
}
