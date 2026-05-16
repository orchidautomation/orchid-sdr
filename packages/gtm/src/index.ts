export { withTrellisRuntime } from "./hosted-runtime.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import * as v from "valibot";

export type TrellisProviderKind =
  | "source"
  | "crm"
  | "mail"
  | "browser"
  | "email"
  | "enrichment"
  | "research"
  | "observability"
  | "handoff";

export interface TrellisProviderDefinition {
  id: string;
  kind: TrellisProviderKind;
  displayName: string;
  config?: Record<string, unknown>;
  env?: Array<{
    name: string;
    required?: boolean;
    description?: string;
  }>;
  capabilities?: string[];
}

export type TrellisFieldMap = Record<string, string>;

export interface TrellisAttioMap {
  companies?: TrellisFieldMap;
  people?: TrellisFieldMap;
}

export type TrellisMailSequenceOperation = "mail.send" | "mail.reply" | "email.send" | "email.reply";
export type TrellisMailSequenceApproval = "required" | "optional" | "none";
export type TrellisMailSequenceCondition = "always" | "no_reply" | string;
export type TrellisMailSequenceStopCondition =
  | "reply.received"
  | "unsubscribe"
  | "bounce"
  | "manual.pause"
  | "kill_switch"
  | string;

export interface TrellisMailSequenceStep {
  id: string;
  operation: TrellisMailSequenceOperation;
  draftSkill?: string;
  delay?: string;
  condition?: TrellisMailSequenceCondition;
  approval?: TrellisMailSequenceApproval;
  subject?: string;
  bodyText?: string;
}

export interface TrellisMailSequenceMap {
  provider?: "mail" | "agentmail";
  defaultInboxId?: string;
  stopOn?: TrellisMailSequenceStopCondition[];
  steps: TrellisMailSequenceStep[];
}

export type TrellisAgentMailSequenceOperation = TrellisMailSequenceOperation;
export type TrellisAgentMailSequenceApproval = TrellisMailSequenceApproval;
export type TrellisAgentMailSequenceCondition = TrellisMailSequenceCondition;
export type TrellisAgentMailSequenceStopCondition = TrellisMailSequenceStopCondition;
export type TrellisAgentMailSequenceStep = TrellisMailSequenceStep;
export type TrellisAgentMailSequenceMap = TrellisMailSequenceMap;

export type TrellisStateFieldType = "string" | "number" | "boolean" | "json" | "datetime";

export interface TrellisBrowserProfile {
  viewport?: {
    width?: number;
    height?: number;
    deviceScaleFactor?: number;
    isMobile?: boolean;
  };
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
  headers?: Record<string, string>;
  cookies?: Array<Record<string, unknown>>;
  waitFor?: string;
  allowedDomains?: string[];
  blockedResourceTypes?: string[];
}

export interface TrellisBrowserProfileMap {
  defaultProfile?: string;
  profiles: Record<string, TrellisBrowserProfile>;
}

export type TrellisStateFieldDefinition =
  | string
  | {
      source: string;
      type?: TrellisStateFieldType;
      required?: boolean;
    };

export type TrellisStateFields = Record<string, TrellisStateFieldDefinition>;

export type TrellisStateIndexDefinition =
  | string
  | string[]
  | {
      name?: string;
      fields: string[];
      unique?: boolean;
    };

export interface TrellisStateRelationshipDefinition {
  table: string;
  local: string;
  foreign: string;
  many?: boolean;
}

export interface TrellisStateTableDefinition {
  primaryKey: string;
  fields: TrellisStateFields;
  indexes?: TrellisStateIndexDefinition[];
  relationships?: Record<string, TrellisStateRelationshipDefinition>;
}

export interface TrellisStateMap {
  tables: Record<string, TrellisStateTableDefinition>;
}

export interface TrellisSafetyPolicy {
  noSends: boolean;
  requireApproval: string[];
  killSwitch: boolean;
}

export interface TrellisApiKeyAuthConfig {
  type: "apiKey";
  env: string;
  header: string;
  allowUnauthenticated: string[];
}

export interface TrellisAuthConfig {
  apiKey?: TrellisApiKeyAuthConfig;
}

export type TrellisMcpSurface = "operator" | "sdr";
export type TrellisMcpRole = "viewer" | "operator" | "executor" | "admin";
export type TrellisMcpToolCategory = "inspection" | "operation" | "provider" | "operator" | "admin";

export interface TrellisMcpToolsConfig {
  include?: string[];
  exclude?: string[];
  aliases?: Record<string, string>;
  skillTools?: TrellisMcpSkillToolConfig[];
}

export interface TrellisMcpSkillToolConfig {
  name: string;
  skill: string;
  description?: string;
  role?: TrellisMcpRole;
  category?: TrellisMcpToolCategory;
  schema?: z.ZodTypeAny;
  inputSchema?: Record<string, unknown>;
  args?: Record<string, unknown>;
}

export interface TrellisMcpConfig {
  name?: string;
  surface?: TrellisMcpSurface;
  tools?: TrellisMcpToolsConfig;
  operator?: {
    name?: string;
    tools?: TrellisMcpToolsConfig;
  };
}

const DEFAULT_TRELLIS_MODEL = "anthropic/claude-sonnet-4.6";

export interface TrellisAgentConfig {
  crm?: TrellisProviderDefinition;
  mail?: TrellisProviderDefinition;
  email?: TrellisProviderDefinition;
  browser?: TrellisProviderDefinition;
  research?: TrellisProviderDefinition;
  observability?: TrellisProviderDefinition;
  handoff?: TrellisProviderDefinition;
  model?: string;
  state?: TrellisStateMap;
  knowledge: string | string[];
  skills: string | string[];
  safety?: TrellisSafetyPolicy;
  auth?: TrellisAuthConfig;
  mcp?: TrellisMcpConfig;
}

export interface TrellisSignal {
  id: string;
  traceId?: string;
  threadId: string;
  workspaceId: string;
  campaignId?: string;
  idempotencyKey?: string;
  provider?: string;
  source?: string;
  payload?: Record<string, unknown>;
}

export interface TrellisWorkflowStartInput {
  signal: TrellisSignal;
  qualification?: unknown;
  [key: string]: unknown;
}

export interface TrellisWorkflowHandle {
  start(input: TrellisWorkflowStartInput): Promise<unknown> | unknown;
}

export interface TrellisAuditEvent {
  id: string;
  traceId?: string;
  type: string;
  message: string;
  signalId?: string;
  workflow?: string;
  metadata?: Record<string, unknown>;
}

export interface TrellisDraft {
  id: string;
  channel: "email" | string;
  status: "blocked_pending_approval" | string;
  approvalRequiredFor: string[];
  body: string;
}

export interface TrellisApproval {
  id: string;
  traceId?: string;
  draftId: string;
  signalId: string;
  action: string;
  status: "pending" | "approved" | "rejected" | string;
}

export interface TrellisProviderAction {
  id: string;
  approvalId: string;
  signalId: string;
  draftId?: string;
  provider: string;
  operation: string;
  status: "blocked_no_send" | "queued" | "completed" | "failed" | string;
  traceId: string;
}

export interface TrellisProviderActionExecutionResult {
  ok: boolean;
  provider: string;
  operation: string;
  actionId: string;
  externalId?: string | null;
  externalThreadId?: string | null;
  raw?: unknown;
}

export interface TrellisProspect {
  id: string;
  signalId: string;
  workspaceId: string;
  threadId: string;
  status: "needs_review" | "qualified" | "disqualified" | string;
}

export interface TrellisGtmApp {
  signal(): Promise<TrellisSignal> | TrellisSignal;
  context(signal: TrellisSignal): Promise<Record<string, unknown>> | Record<string, unknown>;
  skill(
    name: string,
    input: {
      context: Record<string, unknown>;
      schema?: z.ZodTypeAny;
      args?: Record<string, unknown>;
      role?: string;
      model?: string;
    },
  ): Promise<unknown> | unknown;
  workflow(name: "prospect" | string): TrellisWorkflowHandle;
  harness?: {
    raw(): Promise<unknown> | unknown;
  };
}

export type TrellisAgentHandler<App extends TrellisGtmApp = TrellisGtmApp> = (
  app: App,
) => Promise<unknown> | unknown;

export interface TrellisAgentDefinition<App extends TrellisGtmApp = TrellisGtmApp> {
  kind: "trellis.gtm.agent";
  name: string;
  config: TrellisAgentConfig;
  handler: TrellisAgentHandler<App>;
}

export interface TrellisSmokeCheck {
  id: string;
  status: "pass" | "fail";
  detail: string;
}

export interface TrellisSmokeResult {
  ok: boolean;
  mode: "safe-fixture";
  agent: string;
  externalWrites: false;
  noSendsMode: boolean;
  fixture: TrellisSignal;
  checks: TrellisSmokeCheck[];
  skillCalls: Array<{ name: string; context: Record<string, unknown> }>;
  startedWorkflows: Array<{ name: string; input: TrellisWorkflowStartInput }>;
  prospects: TrellisProspect[];
  drafts: TrellisDraft[];
  approvals: TrellisApproval[];
  auditEvents: TrellisAuditEvent[];
  result: unknown;
}

export interface TrellisProviderSmokeResult {
  ok: boolean;
  mode: "provider-integration";
  provider: "attio";
  externalWrites: true;
  checks: TrellisSmokeCheck[];
  execution?: TrellisProviderActionExecutionResult;
  mappedFields?: {
    companies: string[];
    people: string[];
  };
  error?: string;
}

export interface TrellisSmokeHistory {
  enabled: boolean;
  table?: string;
  id?: string;
  status?: "pass" | "fail";
}

export interface TrellisCloudflareRuntime {
  TrellisAgent: new (state?: unknown, env?: unknown) => {
    fetch(request: Request): Promise<Response>;
  };
  ProspectWorkflow: new (env?: unknown) => {
    run(event?: unknown, step?: unknown): Promise<unknown>;
  };
  worker: {
    fetch(request: Request, env?: Record<string, unknown>): Promise<Response>;
    queue?(batch: TrellisQueueBatch, env?: Record<string, unknown>): Promise<unknown>;
    scheduled?(controller: unknown, env?: Record<string, unknown>, ctx?: unknown): Promise<unknown>;
  };
}

export interface TrellisRuntimeResult {
  signal: TrellisSignal;
  skillCalls: Array<{ name: string; context: Record<string, unknown> }>;
  startedWorkflows: Array<{ name: string; input: TrellisWorkflowStartInput }>;
  prospects: TrellisProspect[];
  drafts: TrellisDraft[];
  approvals: TrellisApproval[];
  auditEvents: TrellisAuditEvent[];
  result: unknown;
}

export interface TrellisHarnessRuntime {
  raw(): Promise<unknown> | unknown;
  skill(
    name: string,
    input: {
      context: Record<string, unknown>;
      schema?: z.ZodTypeAny;
      args?: Record<string, unknown>;
      role?: string;
      model?: string;
    },
  ): Promise<unknown> | unknown;
}

export interface TrellisRuntimeContextFactoryInput {
  env?: Record<string, unknown>;
  config: TrellisAgentConfig;
  signal: Partial<TrellisSignal>;
  packs: unknown;
  tools: TrellisMcpToolDefinition[];
  eventSink?: TrellisEventSink;
}

export interface TrellisMcpToolDefinition {
  name: string;
  description: string;
  provider?: string;
  operation?: string;
  inputSchema?: Record<string, unknown>;
  execute?(input: Record<string, unknown>): Promise<unknown> | unknown;
}

export interface TrellisEventSink {
  emit(event: TrellisTraceEventInput): Promise<void>;
}

export interface TrellisTraceEventInput {
  id?: string;
  traceId: string;
  signalId?: string | null;
  workflow?: string | null;
  span: string;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
}

interface TrellisD1Database {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown> | unknown;
      first<T = Record<string, unknown>>(): Promise<T | null> | T | null;
      all?<T = Record<string, unknown>>(): Promise<{ results?: T[] }> | { results?: T[] };
    };
  };
}

interface TrellisQueue {
  send(message: unknown): Promise<unknown> | unknown;
}

interface TrellisQueueMessage {
  body: unknown;
  ack?(): void;
  retry?(): void;
}

interface TrellisQueueBatch {
  messages: TrellisQueueMessage[];
}

interface TrellisR2Bucket {
  get(key: string): Promise<{ text(): Promise<string> | string } | null> | { text(): Promise<string> | string } | null;
  list?(options?: { prefix?: string }): Promise<{ objects?: Array<{ key: string; size?: number }> }> | { objects?: Array<{ key: string; size?: number }> };
}

interface TrellisWorkflowBinding {
  create(options: {
    id?: string;
    params?: Record<string, unknown>;
  }): Promise<{ id?: string; status?(): Promise<unknown> | unknown } | unknown> | { id?: string; status?(): Promise<unknown> | unknown } | unknown;
}

interface TrellisTraceEventRecord {
  id: string;
  traceId: string;
  signalId: string | null;
  workflow: string | null;
  span: string;
  type: string;
  message: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface TrellisWorkflowStep {
  do<T>(name: string, callback: () => Promise<T> | T): Promise<T> | T;
  sleep?(name: string, duration: string | number): Promise<unknown> | unknown;
}

type TrellisApprovalDecisionStatus = "approved" | "rejected";
type TrellisProviderActionTransitionStatus = "completed" | "failed";

interface TrellisApprovalDecision {
  approvalId: string;
  traceId?: string;
  signalId: string;
  status: TrellisApprovalDecisionStatus;
  action: string;
  draftId?: string;
  actor?: string;
  reason?: string;
}

interface TrellisProviderActionTransition {
  providerActionId: string;
  traceId?: string;
  signalId: string;
  status: TrellisProviderActionTransitionStatus;
  actor?: string;
  reason?: string;
}

interface TrellisProviderActionExecutionRequest {
  providerActionId: string;
  actor?: string;
  reason?: string;
  input?: Record<string, unknown>;
}

type TrellisOperatorControlScope = "global" | "campaign" | "thread";
type TrellisOperatorControlStatus = "enabled" | "disabled" | "paused" | "active";

interface TrellisOperatorControlRecord {
  id: string;
  scope: TrellisOperatorControlScope;
  targetId: string;
  status: TrellisOperatorControlStatus;
  reason?: string | null;
  actor?: string | null;
  updatedAt?: string | null;
}

interface TrellisOperatorControlChange {
  scope: TrellisOperatorControlScope;
  targetId: string;
  status: TrellisOperatorControlStatus;
  actor?: string;
  reason?: string;
  traceId?: string;
}

interface TrellisProviderActionRecord extends TrellisProviderAction {
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface TrellisWorkflowRunRow {
  id: string;
  signalId: string;
  workflow: string;
  status: string;
  paramsJson: string;
  updatedAt?: string | null;
}

interface TrellisDraftRecord {
  id: string;
  signalId: string;
  channel: string;
  status: string;
  body: string;
}

interface TrellisProspectRecord extends TrellisProspect {
  updatedAt?: string | null;
}

interface TrellisSignalRecord {
  id: string;
  traceId: string;
  workspaceId: string;
  threadId: string;
  campaignId?: string | null;
  payload: Record<string, unknown>;
}

interface TrellisProviderExecutionContext {
  action: TrellisProviderActionRecord;
  draft: TrellisDraftRecord | null;
  signal: TrellisSignalRecord | null;
  prospect: TrellisProspectRecord | null;
  workflowRun: TrellisWorkflowRunRecord | null;
  input: Record<string, unknown>;
}

interface TrellisWorkflowRunRecord {
  id: string;
  signalId: string;
  workflow: string;
  status: string;
  params: Record<string, unknown>;
  updatedAt?: string | null;
}

const MAX_PACK_CONTEXT_FILES = 24;
const MAX_PACK_CONTEXT_FILE_CHARS = 16_000;

export const schema = {
  gtm() {
    return z.object({
      workspaces: z.array(z.unknown()).optional(),
      campaigns: z.array(z.unknown()).optional(),
      accounts: z.array(z.unknown()).optional(),
      people: z.array(z.unknown()).optional(),
      signals: z.array(z.unknown()).optional(),
      prospects: z.array(z.unknown()).optional(),
      threads: z.array(z.unknown()).optional(),
      approvals: z.array(z.unknown()).optional(),
      providerActions: z.array(z.unknown()).optional(),
      auditEvents: z.array(z.unknown()).optional(),
    });
  },
  qualification() {
    return z.object({
      decision: z.enum(["qualified", "disqualified", "needs_review"]),
      summary: z.string().min(1),
      confidence: z.number().min(0).max(1),
      matchedEvidence: z.array(z.string()).default([]),
      missingEvidence: z.array(z.string()).default([]),
      nextStep: z.string().optional(),
    });
  },
  researchBrief() {
    return z.object({
      summary: z.string().min(1),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()).default([]),
      sources: z.array(z.string()).default([]),
      copyGuidance: z.string().optional(),
    });
  },
  outboundDraft() {
    return z.object({
      subject: z.string().min(1),
      body: z.string().min(1),
      rationale: z.string().optional(),
    });
  },
  replyPolicy() {
    return z.object({
      classification: z.enum([
        "positive",
        "objection",
        "referral",
        "needs_human",
        "neutral",
        "unsubscribe",
        "bounce",
        "wrong_person",
        "spam_risk",
      ]),
      action: z.enum(["reply", "handoff", "pause"]),
      reason: z.string().min(1),
      confidence: z.number().min(0).max(1),
      nextStep: z.string().optional(),
    });
  },
  handoffPolicy() {
    return z.object({
      shouldHandoff: z.boolean(),
      reason: z.string().min(1),
      destination: z.string().optional(),
      urgency: z.enum(["low", "normal", "high"]).default("normal"),
    });
  },
};

export const trellis = {
  agent<App extends TrellisGtmApp>(
    name: string,
    config: TrellisAgentConfig,
    handler: TrellisAgentHandler<App>,
  ): TrellisAgentDefinition<App> {
    return {
      kind: "trellis.gtm.agent",
      name,
      config: {
        ...config,
        safety: config.safety ?? trellis.safeOutbound(),
      },
      handler,
    };
  },
  safeOutbound(input?: Partial<TrellisSafetyPolicy>): TrellisSafetyPolicy {
    return {
      noSends: input?.noSends ?? true,
      requireApproval: input?.requireApproval ?? ["mail.send", "mail.reply", "crm.update", "handoff.webhook"],
      killSwitch: input?.killSwitch ?? true,
    };
  },
  auth: {
    apiKey(input?: Partial<Pick<TrellisApiKeyAuthConfig, "env" | "header" | "allowUnauthenticated">>): TrellisAuthConfig {
      return {
        apiKey: {
          type: "apiKey",
          env: input?.env ?? "TRELLIS_API_KEY",
          header: input?.header ?? "x-trellis-api-key",
          allowUnauthenticated: input?.allowUnauthenticated ?? ["/healthz", "/smoke"],
        },
      };
    },
  },
  state(definition: TrellisStateMap): TrellisStateMap {
    return definition;
  },
  provider(definition: TrellisProviderDefinition): TrellisProviderDefinition {
    return definition;
  },
  cloudflare(agent: TrellisAgentDefinition<TrellisGtmApp>): TrellisCloudflareRuntime {
    return createCloudflareRuntime(agent);
  },
};

export function createTrellisTestApp(input?: {
  signal?: Partial<TrellisSignal>;
  context?: Record<string, unknown>;
  skillResults?: Record<string, unknown>;
  harness?: TrellisHarnessRuntime;
  eventSink?: TrellisEventSink;
}) {
  const startedWorkflows: Array<{ name: string; input: TrellisWorkflowStartInput }> = [];
  const skillCalls: Array<{ name: string; context: Record<string, unknown> }> = [];
  const prospects: TrellisProspect[] = [];
  const drafts: TrellisDraft[] = [];
  const auditEvents: TrellisAuditEvent[] = [];
  const traceId = readString(input?.signal?.traceId)
    ?? readString(input?.signal?.payload?.traceId)
    ?? `trace_${normalizeIdPart(input?.signal?.id ?? "sig_test")}`;
  const signal: TrellisSignal = {
    id: input?.signal?.id ?? "sig_test",
    traceId,
    threadId: input?.signal?.threadId ?? "thr_test",
    workspaceId: input?.signal?.workspaceId ?? "wrk_test",
    campaignId: input?.signal?.campaignId ?? "cmp_test",
    idempotencyKey: input?.signal?.idempotencyKey,
    provider: input?.signal?.provider ?? "fixture",
    source: input?.signal?.source ?? "manual",
    payload: input?.signal?.payload ?? {},
  };

  const app: TrellisGtmApp & {
    fixtureSignal: TrellisSignal;
    startedWorkflows: typeof startedWorkflows;
    skillCalls: typeof skillCalls;
    prospects: typeof prospects;
    drafts: typeof drafts;
    auditEvents: typeof auditEvents;
  } = {
    fixtureSignal: signal,
    startedWorkflows,
    skillCalls,
    prospects,
    drafts,
    auditEvents,
    async signal() {
      const event = {
        id: nextAuditEventId(signal, auditEvents),
        traceId: signal.traceId,
        type: "signal.accepted",
        message: "Accepted fixture signal.",
        signalId: signal.id,
        metadata: {
          provider: signal.provider,
          source: signal.source,
          threadId: signal.threadId,
        },
      };
      auditEvents.push(event);
      return signal;
    },
    context(currentSignal) {
      return {
        signal: currentSignal,
        runtime: createTrellisRuntimeContext(),
        ...(input?.context ?? {}),
      };
    },
    async skill(name, skillInput) {
      skillCalls.push({
        name,
        context: skillInput.context,
      });
      await emitTrellisTrace(input?.eventSink, {
        id: `trace_event_skill_started_${normalizeIdPart(signal.id)}_${normalizeIdPart(name)}_${skillCalls.length}`,
        traceId: traceIdForSignal(signal),
        signalId: signal.id,
        span: `skill:${name}`,
        type: "skill.started",
        message: `Started skill ${name}.`,
        payload: {
          skill: name,
          role: skillInput.role ?? null,
          model: skillInput.model ?? null,
        },
      });
      if (input?.harness) {
        try {
          const harnessResult = await input.harness.skill(name, skillInput);
          const parsed = parseSkillOutput(harnessResult, skillInput.schema);
          const event = {
            id: nextAuditEventId(signal, auditEvents),
            traceId: signal.traceId,
            type: "skill.completed",
            message: `Completed skill ${name}.`,
            signalId: signal.id,
            metadata: {
              skill: name,
              role: skillInput.role ?? null,
              model: skillInput.model ?? null,
              harness: true,
            },
          };
          auditEvents.push(event);
          await emitAuditTraceEvent(input?.eventSink, event, signal);
          return parsed;
        } catch (error) {
          const event = {
            id: nextAuditEventId(signal, auditEvents),
            traceId: signal.traceId,
            type: "skill.fallback",
            message: `Skill ${name} fell back to deterministic safe-mode output after the harness failed.`,
            signalId: signal.id,
            metadata: {
              skill: name,
              role: skillInput.role ?? null,
              model: skillInput.model ?? null,
              harness: true,
              error: sanitizeRuntimeError(error),
            },
          };
          auditEvents.push(event);
          await emitAuditTraceEvent(input?.eventSink, event, signal);
        }
      }

      try {
        const result = input?.skillResults?.[name] ?? {
          ...defaultSkillResult(name),
        };
        const parsed = parseSkillOutput(result, skillInput.schema);
        const event = {
          id: nextAuditEventId(signal, auditEvents),
          traceId: signal.traceId,
          type: "skill.completed",
          message: `Completed skill ${name}.`,
          signalId: signal.id,
          metadata: {
            skill: name,
            role: skillInput.role ?? null,
            model: skillInput.model ?? null,
            harness: false,
          },
        };
        auditEvents.push(event);
        await emitAuditTraceEvent(input?.eventSink, event, signal);
        return parsed;
      } catch (error) {
        await emitTrellisTrace(input?.eventSink, {
          id: `trace_event_skill_failed_${normalizeIdPart(signal.id)}_${normalizeIdPart(name)}_${skillCalls.length}`,
          traceId: traceIdForSignal(signal),
          signalId: signal.id,
          span: `skill:${name}`,
          type: "skill.failed",
          message: `Failed skill ${name}.`,
          payload: {
            skill: name,
            error: sanitizeRuntimeError(error),
          },
        });
        throw error;
      }
    },
    workflow(name) {
      return {
        async start(workflowInput) {
          startedWorkflows.push({ name, input: workflowInput });
          const decision = readQualificationDecision(workflowInput.qualification);
          prospects.push({
            id: `prospect_${signal.id}`,
            signalId: signal.id,
            workspaceId: signal.workspaceId,
            threadId: signal.threadId,
            status: decision,
          });
          const approvalRequiredFor = approvalActionsForWorkflow(name, workflowInput);
          drafts.push({
            id: `draft_${signal.id}`,
            channel: name === "reply" ? "reply" : "email",
            status: "blocked_pending_approval",
            approvalRequiredFor,
            body: readWorkflowDraftBody(name, workflowInput),
          });
          const workflowStarted = {
            id: nextAuditEventId(signal, auditEvents),
            traceId: signal.traceId,
            type: "workflow.started",
            message: `Started workflow ${name}.`,
            signalId: signal.id,
            workflow: name,
            metadata: {
              draftId: `draft_${signal.id}`,
              approvalRequiredFor,
            },
          };
          auditEvents.push(workflowStarted);
          await emitAuditTraceEvent(input?.eventSink, workflowStarted, signal);
          const draftCreated = {
            id: nextAuditEventId(signal, auditEvents),
            traceId: signal.traceId,
            type: "draft.created",
            message: "Created draft and blocked side effects pending approval.",
            signalId: signal.id,
            workflow: name,
            metadata: {
              draftId: `draft_${signal.id}`,
              channel: name === "reply" ? "reply" : "email",
              approvalRequiredFor,
            },
          };
          auditEvents.push(draftCreated);
          await emitAuditTraceEvent(input?.eventSink, draftCreated, signal);
          return {
            ok: true,
            workflow: name,
            input: workflowInput,
            draftStatus: "blocked_pending_approval",
          };
        },
      };
    },
  };
  if (input?.harness) {
    app.harness = {
      raw: () => input.harness!.raw(),
    };
  }

  return app;
}

function nextAuditEventId(signal: TrellisSignal, auditEvents: TrellisAuditEvent[]) {
  return `evt_${normalizeIdPart(signal.id)}_${auditEvents.length + 1}`;
}

function createTrellisEventSink(env: Record<string, unknown> | undefined): TrellisEventSink | undefined {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return undefined;
  }

  return {
    async emit(event) {
      await ensureD1Schema(db);
      await insertTraceEvent(env, db, {
        ...event,
        id: event.id ?? traceEventId(event),
        signalId: event.signalId ?? undefined,
        workflow: event.workflow ?? undefined,
        payload: redactTracePayload(event.payload ?? {}),
      });
      await notifySlackForTraceEvent(env, {
        id: event.id ?? traceEventId(event),
        traceId: event.traceId,
        signalId: event.signalId ?? null,
        workflow: event.workflow ?? null,
        span: event.span,
        type: event.type,
        message: event.message,
        payload: redactTracePayload(event.payload ?? {}),
        createdAt: new Date().toISOString(),
      }).catch(async (error) => {
        await insertTraceEvent(env, db, {
          id: `trace_event_slack_notify_failed_${normalizeIdPart(event.type)}_${stableHashPart(String(Date.now()))}`,
          traceId: event.traceId,
          signalId: event.signalId ?? undefined,
          workflow: "slack",
          span: "slack",
          type: "slack.notify.failed",
          message: "Slack notification failed.",
          payload: {
            eventType: event.type,
            error: sanitizeRuntimeError(error),
          },
        });
      });
    },
  };
}

async function emitAuditTraceEvent(
  eventSink: TrellisEventSink | undefined,
  event: TrellisAuditEvent,
  signal: TrellisSignal,
) {
  await emitTrellisTrace(eventSink, {
    id: `trace_event_${event.id}`,
    traceId: event.traceId ?? traceIdForSignal(signal),
    signalId: event.signalId ?? signal.id,
    workflow: event.workflow,
    type: event.type,
    span: traceSpanForAuditEvent(event),
    message: event.message,
    payload: event.metadata ?? {},
  });
}

async function emitTrellisTrace(eventSink: TrellisEventSink | undefined, event: TrellisTraceEventInput) {
  if (!eventSink) {
    return;
  }
  await eventSink.emit({
    ...event,
    payload: redactTracePayload(event.payload ?? {}),
  });
}

function traceEventId(event: TrellisTraceEventInput) {
  return `trace_event_${normalizeIdPart(event.type)}_${normalizeIdPart(event.signalId ?? event.traceId)}_${stableHashPart(JSON.stringify(event.payload ?? {}))}`;
}

function traceIdForPartialSignal(signal: Partial<TrellisSignal>) {
  return readString(signal.traceId)
    ?? readString(signal.payload?.traceId)
    ?? traceIdForSignalId(readString(signal.id) ?? "unknown");
}

function redactTracePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return redactTraceValue(payload) as Record<string, unknown>;
}

const REDACTED_TRACE_KEYS = new Set([
  "body",
  "bodyText",
  "content",
  "html",
  "messages",
  "payload",
  "prompt",
  "raw",
  "reply",
  "request",
  "requestPayload",
  "response",
  "responsePayload",
  "text",
]);

function redactTraceValue(value: unknown, key = ""): unknown {
  if (REDACTED_TRACE_KEYS.has(key)) {
    return "[redacted]";
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeRuntimeError(value),
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redactTraceValue(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactTraceValue(entryValue, entryKey),
    ]));
  }
  return value;
}

async function bridgeFlueEventToTrellisTrace(
  eventSink: TrellisEventSink | undefined,
  signal: Partial<TrellisSignal>,
  event: Record<string, unknown>,
) {
  if (!eventSink) {
    return;
  }
  const type = readString(event.type);
  if (!type || type === "text_delta" || type === "thinking_delta" || type === "thinking_start" || type === "thinking_end") {
    return;
  }
  if (!["turn", "tool_start", "tool_call", "log"].includes(type)) {
    return;
  }
  const traceId = traceIdForPartialSignal(signal);
  const signalId = readString(signal.id);
  const toolName = readString(event.toolName);
  await emitTrellisTrace(eventSink, {
    id: `trace_event_flue_${normalizeIdPart(type)}_${normalizeIdPart(signalId ?? traceId)}_${stableHashPart(JSON.stringify(event))}`,
    traceId,
    signalId,
    span: toolName ? `tool:${toolName}` : type === "turn" ? "model" : "runtime",
    type: `flue.${type}`,
    message: flueEventMessage(type, event),
    payload: {
      type,
      toolName,
      toolCallId: readString(event.toolCallId),
      level: readString(event.level),
      message: readString(event.message),
      model: readString(event.model),
      stopReason: readString(event.stopReason),
      durationMs: readNumber(event.durationMs),
      isError: typeof event.isError === "boolean" ? event.isError : undefined,
      usage: isRecord(event.usage) ? event.usage : undefined,
      error: event.error ? sanitizeRuntimeError(event.error) : undefined,
    },
  });
}

function flueEventMessage(type: string, event: Record<string, unknown>) {
  if (type === "tool_start") {
    return `Started tool ${readString(event.toolName) ?? "unknown"}.`;
  }
  if (type === "tool_call") {
    return `Completed tool ${readString(event.toolName) ?? "unknown"}.`;
  }
  if (type === "turn") {
    return "Completed model turn.";
  }
  return readString(event.message) ?? "Trellis runtime log.";
}

export async function runTrellisSmoke(input?: {
  agent?: TrellisAgentDefinition<TrellisGtmApp>;
  signal?: Partial<TrellisSignal>;
  skillResults?: Record<string, unknown>;
}): Promise<TrellisSmokeResult> {
  const agent = input?.agent ?? createDefaultSmokeAgent();
  const run = await runTrellisAgent(agent, {
    signal: {
      id: "sig_smoke_001",
      threadId: "thr_smoke_001",
      workspaceId: "wrk_smoke",
      campaignId: "cmp_smoke",
      provider: "fixture",
      source: "fixture.webhook",
      payload: {
        account: "Acme Corp",
        signal: "Asked for a better way to operationalize GTM agents.",
      },
      ...(input?.signal ?? {}),
    },
    skillResults: input?.skillResults ?? {
      "icp-qualification": {
        decision: "needs_review",
        summary: "Fixture signal has enough context to create a draft, but needs human review.",
        confidence: 0.67,
        matchedEvidence: ["GTM agent workflow pain"],
        missingEvidence: ["Confirmed budget", "Named buying committee"],
        nextStep: "Review and approve the draft before any side effect.",
      },
    },
  });
  const checks = [
    smokeCheck(
      "agent.manifest",
      agent.kind === "trellis.gtm.agent" && Boolean(agent.config.knowledge) && Boolean(agent.config.skills),
      "loaded Trellis agent manifest with knowledge and skills",
    ),
    smokeCheck(
      "signal.accepted",
      run.auditEvents.some((event) => event.type === "signal.accepted"),
      "accepted one fixture GTM signal",
    ),
    smokeCheck(
      "skill.qualification",
      run.skillCalls.some((call) => call.name === "icp-qualification"),
      "ran icp-qualification through the Trellis skill API",
    ),
    smokeCheck(
      "workflow.prospect",
      run.startedWorkflows.some((workflow) => workflow.name === "prospect"),
      "started the prospect workflow",
    ),
    smokeCheck(
      "state.prospect",
      run.prospects.length === 1,
      "created a prospect state projection",
    ),
    smokeCheck(
      "draft.blocked",
      run.drafts.some((draft) => draft.status === "blocked_pending_approval"),
      "created an outbound draft without sending it",
    ),
    smokeCheck(
      "audit.events",
      ["signal.accepted", "skill.completed", "workflow.started", "draft.created"].every((type) =>
        run.auditEvents.some((event) => event.type === type),
      ),
      "recorded signal, skill, workflow, and draft audit events",
    ),
    smokeCheck(
      "safety.approvals",
      agent.config.safety?.noSends === true
        && ["mail.send", "crm.update"].every((approval) =>
          agent.config.safety?.requireApproval.includes(approval),
        ),
      "kept no-send mode and approval gates enabled",
    ),
  ];

  return {
    ok: checks.every((check) => check.status === "pass"),
    mode: "safe-fixture",
    agent: agent.name,
    externalWrites: false,
    noSendsMode: agent.config.safety?.noSends ?? false,
    fixture: run.signal,
    checks,
    skillCalls: run.skillCalls,
    startedWorkflows: run.startedWorkflows,
    prospects: run.prospects,
    drafts: run.drafts,
    approvals: run.approvals,
    auditEvents: run.auditEvents,
    result: run.result,
  };
}

export async function runTrellisAttioSmoke(input?: {
  agent?: TrellisAgentDefinition<TrellisGtmApp>;
  env?: Record<string, unknown>;
}): Promise<TrellisProviderSmokeResult> {
  const agent = input?.agent ?? createDefaultSmokeAgent();
  const env = input?.env;
  const apiKeyConfigured = Boolean(readString(env?.ATTIO_API_KEY));
  const checks: TrellisSmokeCheck[] = [
    smokeCheck(
      "attio.credentials",
      apiKeyConfigured,
      "ATTIO_API_KEY is configured for a real Attio provider smoke write",
    ),
  ];
  if (!apiKeyConfigured) {
    return {
      ok: false,
      mode: "provider-integration",
      provider: "attio",
      externalWrites: true,
      checks,
      error: "ATTIO_API_KEY is not configured.",
    };
  }

  const context = createAttioSmokeContext(env);
  const map = readAttioMap(agent.config.crm) ?? defaultAttioSmokeMap();
  const mapSource = buildAttioMapSource(context);
  const mappedCompanyValues = normalizeAttioCompanyMappedValues(applyAttioFieldMap(map?.companies, mapSource));
  const mappedPersonValues = normalizeAttioPersonMappedValues(applyAttioFieldMap(map?.people, mapSource));
  const mappedFields = {
    companies: Object.keys(mappedCompanyValues),
    people: Object.keys(mappedPersonValues),
  };
  checks.push(smokeCheck(
    "attio.fieldMap",
    mappedFields.companies.length > 0 || mappedFields.people.length > 0,
    "resolved Attio field map values from Trellis signal and workflow context",
  ));

  try {
    const execution = await executeAttioCrmUpdate(env, context, map);
    const raw = isRecord(execution.raw) ? execution.raw : {};
    const companyRef = isRecord(raw.company) ? raw.company : {};
    const personRef = isRecord(raw.person) ? raw.person : {};
    checks.push(smokeCheck(
      "attio.company.write",
      Boolean(readString(companyRef.recordId)),
      "Attio accepted the company upsert",
    ));
    checks.push(smokeCheck(
      "attio.person.write",
      Boolean(readString(personRef.recordId)),
      "Attio accepted the person upsert",
    ));
    return {
      ok: checks.every((check) => check.status === "pass") && execution.ok === true,
      mode: "provider-integration",
      provider: "attio",
      externalWrites: true,
      checks,
      execution,
      mappedFields,
    };
  } catch (error) {
    checks.push(smokeCheck(
      "attio.write",
      false,
      error instanceof Error ? error.message : String(error),
    ));
    return {
      ok: false,
      mode: "provider-integration",
      provider: "attio",
      externalWrites: true,
      checks,
      mappedFields,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function createAttioSmokeContext(env: Record<string, unknown> | undefined): TrellisProviderExecutionContext {
  const now = new Date().toISOString();
  const domain = normalizeDomain(readString(env?.TRELLIS_ATTIO_SMOKE_DOMAIN) ?? "trellis-smoke.example.com")
    ?? "trellis-smoke.example.com";
  const email = readString(env?.TRELLIS_ATTIO_SMOKE_EMAIL) ?? "trellis-smoke@example.com";
  const traceId = `trace_attio_smoke_${normalizeIdPart(now)}`;
  const payload = {
    company: "Trellis Smoke Test",
    domain,
    fullName: "Trellis Smoke",
    email,
    title: "Provider Smoke",
    linkedinUrl: "https://linkedin.com/company/trellis-smoke",
    signal: "Trellis Attio provider smoke write.",
  };
  const signal = {
    id: "sig_attio_smoke",
    traceId,
    workspaceId: "wrk_smoke",
    threadId: "thr_attio_smoke",
    campaignId: "cmp_smoke",
    payload,
  };
  const draft = {
    id: "draft_attio_smoke",
    signalId: signal.id,
    channel: "email",
    status: "blocked_pending_approval",
    body: "Provider smoke fixture. Do not send.",
  };
  return {
    action: {
      id: "provider_action_attio_smoke_crm_update",
      approvalId: "approval_attio_smoke_crm_update",
      signalId: signal.id,
      draftId: draft.id,
      provider: "attio",
      operation: "crm.update",
      status: "queued",
      traceId,
      createdAt: now,
      updatedAt: now,
    },
    draft,
    signal,
    prospect: {
      id: "prospect_attio_smoke",
      signalId: signal.id,
      workspaceId: signal.workspaceId,
      threadId: signal.threadId,
      status: "needs_review",
      updatedAt: now,
    },
    workflowRun: {
      id: "trellis_attio_smoke_prospect",
      signalId: signal.id,
      workflow: "prospect",
      status: "smoke",
      params: {
        signal,
        qualification: {
          decision: "needs_review",
          summary: "Attio provider smoke qualification.",
          confidence: 0.99,
        },
        research: {
          summary: "Attio smoke verified mapped fields before writing.",
        },
        draft,
      },
      updatedAt: now,
    },
    input: payload,
  };
}

function defaultAttioSmokeMap(): TrellisAttioMap {
  return {
    companies: {
      name: "company",
      domains: "domain",
    },
    people: {
      name: "fullName",
      email_addresses: "email",
      job_title: "title",
    },
  };
}

export async function runTrellisAgent(
  agent: TrellisAgentDefinition<TrellisGtmApp>,
  input?: {
    signal?: Partial<TrellisSignal>;
    context?: Record<string, unknown>;
    skillResults?: Record<string, unknown>;
    harness?: TrellisHarnessRuntime;
    eventSink?: TrellisEventSink;
    providerRun?: {
      id: string;
      provider: string;
      kind: string;
      externalId?: string | null;
      signalsReceived?: number;
    };
  },
): Promise<TrellisRuntimeResult> {
  const app = createTrellisTestApp(input);
  try {
    await emitTrellisTrace(input?.eventSink, {
      id: `trace_event_signal_accepted_${normalizeIdPart(app.fixtureSignal.id)}`,
      traceId: traceIdForSignal(app.fixtureSignal),
      signalId: app.fixtureSignal.id,
      span: "signal",
      type: "signal.accepted",
      message: "Accepted Trellis signal.",
      payload: {
        provider: app.fixtureSignal.provider,
        source: app.fixtureSignal.source,
        threadId: app.fixtureSignal.threadId,
        workspaceId: app.fixtureSignal.workspaceId,
        campaignId: app.fixtureSignal.campaignId ?? null,
      },
    });
    if (input?.providerRun) {
      await emitTrellisTrace(input.eventSink, {
        id: `trace_event_provider_run_started_${normalizeIdPart(input.providerRun.id)}_${normalizeIdPart(app.fixtureSignal.id)}`,
        traceId: traceIdForSignal(app.fixtureSignal),
        signalId: app.fixtureSignal.id,
        span: `provider:${input.providerRun.provider}`,
        type: "provider_run.started",
        message: `Started provider run ${input.providerRun.id}.`,
        payload: {
          providerRunId: input.providerRun.id,
          provider: input.providerRun.provider,
          kind: input.providerRun.kind,
          externalId: input.providerRun.externalId ?? null,
          signalsReceived: input.providerRun.signalsReceived ?? null,
        },
      });
    }
    const result = await agent.handler(app);
    const approvals = createApprovalsForDrafts(app.fixtureSignal, app.drafts);
    for (const approval of approvals) {
      await emitTrellisTrace(input?.eventSink, {
        id: `trace_event_approval_waiting_${normalizeIdPart(approval.id)}`,
        traceId: approval.traceId ?? traceIdForSignal(app.fixtureSignal),
        signalId: approval.signalId,
        workflow: "approval",
        span: "approval",
        type: "approval.waiting",
        message: `Approval ${approval.id} is waiting for ${approval.action}.`,
        payload: {
          approvalId: approval.id,
          draftId: approval.draftId,
          action: approval.action,
          status: approval.status,
        },
      });
    }
    await emitTrellisTrace(input?.eventSink, {
      id: `trace_event_run_completed_${normalizeIdPart(traceIdForSignal(app.fixtureSignal))}`,
      traceId: traceIdForSignal(app.fixtureSignal),
      signalId: app.fixtureSignal.id,
      span: "runtime",
      type: "run.completed",
      message: "Completed Trellis run.",
      payload: {
        signalId: app.fixtureSignal.id,
        threadId: app.fixtureSignal.threadId,
        prospects: app.prospects.length,
        drafts: app.drafts.length,
        approvals: approvals.length,
        workflows: app.startedWorkflows.map((workflow) => workflow.name),
      },
    });
    return {
      signal: app.fixtureSignal,
      skillCalls: app.skillCalls,
      startedWorkflows: app.startedWorkflows,
      prospects: app.prospects,
      drafts: app.drafts,
      approvals,
      auditEvents: app.auditEvents,
      result,
    };
  } catch (error) {
    await emitTrellisTrace(input?.eventSink, {
      id: `trace_event_run_failed_${normalizeIdPart(traceIdForSignal(app.fixtureSignal))}`,
      traceId: traceIdForSignal(app.fixtureSignal),
      signalId: app.fixtureSignal.id,
      span: "runtime",
      type: "run.failed",
      message: "Failed Trellis run.",
      payload: {
        signalId: app.fixtureSignal.id,
        threadId: app.fixtureSignal.threadId,
        error: sanitizeRuntimeError(error),
      },
    });
    throw error;
  }
}

function createDefaultSmokeAgent() {
  return trellis.agent("sdr", {
    knowledge: "knowledge/**/*.md",
    skills: "skills/**/SKILL.md",
    safety: trellis.safeOutbound(),
  }, async (app) => {
    const signal = await app.signal();
    const context = await app.context(signal);
    const qualification = await app.skill("icp-qualification", {
      context,
      schema: schema.qualification(),
    });
    const research = await app.skill("research-brief", {
      context,
      args: { qualification },
      schema: schema.researchBrief(),
    });
    const draft = await app.skill("sdr-copy", {
      context,
      args: { qualification, research },
      schema: schema.outboundDraft(),
    });

    return app.workflow("prospect").start({ signal, qualification, research, draft });
  });
}

function defaultSkillResult(name: string) {
  switch (name) {
    case "research-brief":
      return {
        summary: "Fixture research found a GTM workflow pain signal and enough account context to draft.",
        confidence: 0.64,
        evidence: ["Signal mentions operationalizing GTM agents"],
        sources: ["fixture.webhook"],
        copyGuidance: "Keep the email specific, short, and approval-gated.",
      };
    case "sdr-copy":
      return {
        subject: "GTM agent workflow",
        body: "Saw your note about operationalizing GTM agents. Worth comparing notes on how teams are making the workflow reliable before letting anything send.",
        rationale: "Anchored to the signal while staying in no-send mode.",
      };
    case "reply-policy":
      return {
        classification: "needs_human",
        action: "handoff",
        reason: "Fixture reply needs an operator before Trellis sends anything.",
        confidence: 0.72,
        nextStep: "Create a handoff or approved reply draft.",
      };
    case "handoff-policy":
      return {
        shouldHandoff: true,
        reason: "Fixture reply should be reviewed by a human operator.",
        destination: "sales",
        urgency: "normal",
      };
    case "icp-qualification":
    default:
      return {
        decision: "needs_review",
        summary: "Fixture qualification result.",
        confidence: 0.5,
        matchedEvidence: [],
        missingEvidence: [],
      };
  }
}

function createTrellisRuntimeContext(now = new Date()) {
  const timeZone = "America/New_York";
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return {
    now: now.toISOString(),
    today: dateFormatter.format(now),
    timeZone,
  };
}

function readDraftBody(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }
  const body = readString(value.body) ?? readString(value.bodyText) ?? readString(value.text);
  const subject = readString(value.subject);
  return subject && body ? `Subject: ${subject}\n\n${body}` : body;
}

function readWorkflowDraftBody(name: string, workflowInput: TrellisWorkflowStartInput) {
  if (name !== "reply") {
    return readDraftBody(workflowInput.draft) ?? "Fixture outbound draft. Not sent.";
  }

  const reply = isRecord(workflowInput.reply) ? workflowInput.reply : {};
  const handoff = isRecord(workflowInput.handoff) ? workflowInput.handoff : {};
  const action = readString(reply.action) ?? "handoff";
  const reason = readString(handoff.reason) ?? readString(reply.reason) ?? "Inbound reply needs operator review.";
  return `Reply workflow action: ${action}\n\n${reason}`;
}

function approvalActionsForWorkflow(name: string, workflowInput: TrellisWorkflowStartInput) {
  const explicitApprovalActions = readStringArray(workflowInput.approvalRequiredFor);
  if (explicitApprovalActions.length > 0) {
    return explicitApprovalActions;
  }

  if (name !== "reply") {
    return ["mail.send", "crm.update"];
  }

  const reply = isRecord(workflowInput.reply) ? workflowInput.reply : {};
  const handoff = isRecord(workflowInput.handoff) ? workflowInput.handoff : {};
  const replyAction = readString(reply.action);
  const shouldHandoff = readBoolean(handoff.shouldHandoff) ?? replyAction === "handoff";
  const actions = [];
  if (replyAction === "reply") {
    actions.push("mail.reply");
  }
  if (shouldHandoff) {
    actions.push("handoff.webhook");
  }
  return actions;
}

function smokeCheck(id: string, passed: boolean, detail: string): TrellisSmokeCheck {
  return {
    id,
    status: passed ? "pass" : "fail",
    detail,
  };
}

function readQualificationDecision(value: unknown): TrellisProspect["status"] {
  if (typeof value !== "object" || value === null || !("decision" in value)) {
    return "needs_review";
  }
  const decision = (value as { decision?: unknown }).decision;
  return typeof decision === "string" ? decision : "needs_review";
}

function parseSkillOutput(value: unknown, schema: z.ZodTypeAny | undefined) {
  const normalized = normalizeSkillOutput(value);
  return schema ? schema.parse(normalized) : normalized;
}

function sanitizeRuntimeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/\[flue\]\s*/gi, "")
    .replace(/\bFlue\b/g, "Trellis runtime")
    .replace(/\bflue\b/g, "Trellis runtime");
}

function normalizeSkillOutput(value: unknown): unknown {
  if (isRecord(value) && "data" in value) {
    return value.data;
  }
  if (isRecord(value) && "result" in value) {
    return value.result;
  }
  if (isRecord(value) && typeof value.text === "string") {
    try {
      return JSON.parse(value.text);
    } catch {
      return value;
    }
  }
  return value;
}

function createApprovalsForDrafts(signal: TrellisSignal, drafts: TrellisDraft[]): TrellisApproval[] {
  return drafts.flatMap((draft) =>
    draft.approvalRequiredFor.map((action) => ({
      id: `approval_${draft.id}_${action.replace(/[^a-z0-9]+/gi, "_")}`,
      traceId: traceIdForSignal(signal),
      draftId: draft.id,
      signalId: signal.id,
      action,
      status: "pending",
    })),
  );
}

function matchApprovalDecisionRoute(pathname: string) {
  const match = pathname.match(/^\/approvals\/([^/]+)\/(approve|reject)$/);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return {
    approvalId: decodeURIComponent(match[1]),
    status: match[2] === "approve" ? "approved" as const : "rejected" as const,
  };
}

function matchProviderActionTransitionRoute(pathname: string) {
  const match = pathname.match(/^\/provider-actions\/([^/]+)\/(complete|fail)$/);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return {
    providerActionId: decodeURIComponent(match[1]),
    status: match[2] === "complete" ? "completed" as const : "failed" as const,
  };
}

function matchProviderActionExecutionRoute(pathname: string) {
  const match = pathname.match(/^\/provider-actions\/([^/]+)\/execute$/);
  if (!match?.[1]) {
    return undefined;
  }
  return {
    providerActionId: decodeURIComponent(match[1]),
  };
}

function matchOperatorControlRoute(pathname: string) {
  const killSwitch = pathname.match(/^\/operator\/kill-switch\/(enable|disable)$/);
  if (killSwitch?.[1]) {
    return {
      scope: "global" as const,
      targetId: "kill_switch",
      status: killSwitch[1] === "enable" ? "enabled" as const : "disabled" as const,
    };
  }

  const scoped = pathname.match(/^\/operator\/(campaigns|threads)\/([^/]+)\/(pause|resume)$/);
  if (!scoped?.[1] || !scoped[2] || !scoped[3]) {
    return undefined;
  }
  return {
    scope: scoped[1] === "campaigns" ? "campaign" as const : "thread" as const,
    targetId: decodeURIComponent(scoped[2]),
    status: scoped[3] === "pause" ? "paused" as const : "active" as const,
  };
}

function matchOperatorReplayRoute(pathname: string) {
  const workflow = pathname.match(/^\/operator\/workflows\/([^/]+)\/replay$/);
  if (workflow?.[1]) {
    return {
      kind: "workflow" as const,
      id: decodeURIComponent(workflow[1]),
    };
  }

  const providerAction = pathname.match(/^\/operator\/provider-actions\/([^/]+)\/replay$/);
  if (providerAction?.[1]) {
    return {
      kind: "provider-action" as const,
      id: decodeURIComponent(providerAction[1]),
    };
  }

  return undefined;
}

function inferApprovalAction(approvalId: string) {
  if (approvalId.endsWith("_email_send")) {
    return "mail.send";
  }
  if (approvalId.endsWith("_mail_reply")) {
    return "mail.reply";
  }
  if (approvalId.endsWith("_crm_update")) {
    return "crm.update";
  }
  if (approvalId.endsWith("_handoff_webhook")) {
    return "handoff.webhook";
  }
  return "provider.action";
}

function inferApprovalDraftId(approvalId: string) {
  const action = inferApprovalAction(approvalId).replace(/[^a-z0-9]+/gi, "_");
  const prefix = "approval_";
  const suffix = `_${action}`;
  if (!approvalId.startsWith(prefix) || !approvalId.endsWith(suffix)) {
    return undefined;
  }
  return approvalId.slice(prefix.length, -suffix.length);
}

function createCloudflareRuntime(agent: TrellisAgentDefinition<TrellisGtmApp>): TrellisCloudflareRuntime {
  class TrellisAgentObject {
    constructor(
      private readonly state?: unknown,
      private readonly env?: unknown,
    ) {}

    async fetch(request?: Request) {
      return jsonResponse({
        ok: true,
        runtime: "trellis-agent",
        agent: agent.name,
        path: request ? new URL(request.url).pathname : null,
        storage: "durable-object-sqlite",
        snapshot: await readDurableAgentSnapshot(this.state),
        state: Boolean(this.state),
        env: Boolean(this.env),
      });
    }
  }

  class ProspectWorkflowObject {
    private readonly env?: Record<string, unknown>;

    constructor(env?: unknown) {
      this.env = isRecord(env) ? env : undefined;
    }

    async run(event?: unknown, step?: unknown) {
      const params = readWorkflowEventParams(event);
      const workflow = readString(params.workflow) ?? "prospect";
      const signal = readWorkflowSignal(params.signal);
      const traceId = readString(params.traceId) ?? traceIdForSignal(signal);
      const runId = readString(params.workflowRunId)
        ?? readString(params.runId)
        ?? `trellis_${normalizeIdPart(signal.id)}_${normalizeIdPart(workflow)}`;

      if (workflow === "follow_up") {
        return runFollowUpWorkflow(this.env, {
          params,
          runId,
          signal,
          step,
          traceId,
        });
      }

      const started = await runWorkflowStep(step, "record workflow start", () =>
        recordWorkflowRun(this.env, {
          id: runId,
          traceId,
          signalId: signal.id,
          workflow,
          status: "running",
          params,
        }),
      );
      const checkpoint = await runWorkflowStep(step, "plan approval gate", () => ({
        signalId: signal.id,
        traceId,
        workflow,
        prospectIds: readStringArray(params.prospectIds),
        draftIds: readStringArray(params.draftIds),
        approvalIds: readStringArray(params.approvalIds),
        auditEventIds: readStringArray(params.auditEventIds),
        next: workflow === "reply" ? "await_reply_or_handoff_approval" : "await_outbound_approval",
      }));
      const waiting = await runWorkflowStep(step, "record approval wait", () =>
        recordWorkflowRun(this.env, {
          id: runId,
          traceId,
          signalId: signal.id,
          workflow,
          status: "waiting_for_approval",
          params: {
            ...params,
            checkpoint,
          },
        }),
      );
      return {
        ok: true,
        workflow,
        agent: agent.name,
        runId,
        traceId,
        signalId: signal.id,
        status: "waiting_for_approval",
        checkpoint,
        persistence: {
          started,
          waiting,
        },
        noSendsMode: agent.config.safety?.noSends ?? true,
        externalWrites: false,
        env: Boolean(this.env),
      };
    }
  }

  const worker: TrellisCloudflareRuntime["worker"] = {
      async fetch(request: Request, env?: Record<string, unknown>) {
        const url = new URL(request.url);
        if (url.pathname === "/webhooks/slack" && request.method === "POST") {
          return handleSlackWebhook(request, env, agent.config);
        }

        const auth = verifyTrellisRouteAuth(request, env, agent.config, url.pathname);
        if (!auth.ok) {
          return jsonResponse({
            ok: false,
            error: auth.error,
            detail: auth.detail,
          }, auth.status);
        }

        if (url.pathname === "/healthz") {
          return jsonResponse({
            ok: true,
            agent: agent.name,
            stack: "trellis-cloudflare",
            safety: agent.config.safety ?? trellis.safeOutbound(),
            auth: summarizeRouteAuth(env, agent.config),
            bindings: summarizeCloudflareBindings(env),
            traceExport: summarizeTraceExport(env),
            events: summarizeEventStreaming(env),
            slack: summarizeSlackOperator(env),
          });
        }

        if (url.pathname === "/smoke") {
          const smoke = await runTrellisSmoke({ agent });
          return jsonResponse({
            ...smoke,
            history: await recordSmokeRun(env, smoke),
          });
        }

        if (url.pathname === "/smoke/attio") {
          if (request.method !== "POST") {
            return jsonResponse({
              ok: false,
              error: "method_not_allowed",
              detail: "Attio provider smoke performs an external write and must be called with POST.",
            }, 405);
          }
          const authorization = verifyProviderSmokeRequest(request, env);
          if (!authorization.ok) {
            return jsonResponse({
              ok: false,
              error: authorization.error,
              detail: authorization.detail,
            }, authorization.status);
          }
          const smoke = await runTrellisAttioSmoke({ agent, env });
          return jsonResponse(smoke, smoke.ok ? 200 : providerSmokeFailureStatus(smoke));
        }

        if (url.pathname === "/webhooks/signals" && request.method === "POST") {
          const verification = verifySignalWebhook(request, env);
          if (!verification.ok) {
            return jsonResponse({
              ok: false,
              error: "unauthorized_webhook",
              detail: "Signal webhook secret was configured but not provided.",
            }, 401);
          }
          const signals = await readSignalsFromRequest(request);
          const processed = await processRuntimeSignals(agent, env, signals);
          return jsonResponse(renderProcessedSignalResponse({
            ...processed,
            webhook: {
              verified: verification.enabled,
              idempotencyKey: null,
            },
            noSendsMode: agent.config.safety?.noSends ?? true,
          }), 202);
        }

        if (url.pathname === "/webhooks/apify" && request.method === "POST") {
          const rawBody = await request.text();
          const verification = verifyApifyWebhookRequest(request, env);
          if (!verification.ok) {
            return jsonResponse({
              ok: false,
              error: "unauthorized_apify_webhook",
              detail: "Apify webhook secret was configured but not provided or did not verify.",
            }, 401);
          }
          const parsed = parseJsonText(rawBody);
          const record = isRecord(parsed) ? parsed : {};
          const apify = await readApifyWebhook(record, request, env);
          if (!apify.ok) {
            return jsonResponse({
              ok: false,
              error: apify.error,
              detail: apify.detail,
              webhook: {
                verified: verification.enabled,
                type: "apify",
              },
            }, apify.status);
          }
          if (apify.ignored) {
            return jsonResponse({
              ok: true,
              ignored: true,
              reason: apify.reason,
              webhook: {
                verified: verification.enabled,
                type: "apify",
                eventType: apify.eventType,
                actorRunId: apify.actorRunId,
                datasetId: apify.datasetId,
              },
            });
          }

          const processed = await processRuntimeSignals(agent, env, apify.signals, {
            apify: {
              eventType: apify.eventType,
              actorRunId: apify.actorRunId,
              datasetId: apify.datasetId,
              source: apify.source,
              term: apify.term,
            },
          });
          return jsonResponse(renderProcessedSignalResponse({
            ...processed,
            webhook: {
              verified: verification.enabled,
              type: "apify",
              eventType: apify.eventType,
              actorRunId: apify.actorRunId,
              datasetId: apify.datasetId,
              fetchedDataset: apify.fetchedDataset,
            },
            noSendsMode: agent.config.safety?.noSends ?? true,
          }), 202);
        }

        if (url.pathname === "/webhooks/agentmail" && request.method === "POST") {
          const rawBody = await request.text();
          const verification = await verifyAgentMailWebhookRequest(rawBody, request, env);
          if (!verification.ok) {
            return jsonResponse({
              ok: false,
              error: "unauthorized_agentmail_webhook",
              detail: "AgentMail webhook secret was configured but not provided or did not verify.",
            }, 401);
          }
          const parsed = parseJsonText(rawBody);
          const record = isRecord(parsed) ? parsed : {};
          const agentMail = readAgentMailWebhook(record);
          if (agentMail.type !== "message.received") {
            return jsonResponse({
              ok: true,
              ignored: true,
              reason: `unsupported event type ${agentMail.type || "unknown"}`,
              webhook: {
                verified: verification.enabled,
                type: "agentmail",
              },
            });
          }
          if (!agentMail.providerThreadId || !agentMail.bodyText) {
            return jsonResponse({
              ok: true,
              ignored: true,
              reason: "threadId or bodyText missing",
              webhook: {
                verified: verification.enabled,
                type: "agentmail",
              },
            });
          }

          const signal = agentMailWebhookToSignal(agentMail, record);
          const packContext = await readPackContext(env);
          const eventSink = createTrellisEventSink(env);
          const harness = await createRuntimeHarness(env, agent.config, {
            signal,
            packs: packContext,
            eventSink,
          });
          const run = await runTrellisAgent(agent, {
            signal,
            context: {
              packs: packContext,
              inboundReply: agentMail,
            },
            harness,
            eventSink,
          });
          const persistence = await persistRuntimeResult(env, run, agent.config);
          const queue = await enqueueRuntimeEvent(env, run);
          const workflowDispatch = await dispatchWorkflow(env, run);
          return jsonResponse({
            ok: true,
            accepted: true,
            mode: "processed",
            traceId: traceIdForSignal(run.signal),
            signal: run.signal,
            prospects: run.prospects,
            drafts: run.drafts,
            approvals: run.approvals,
            auditEvents: run.auditEvents,
            persistence,
            queue,
            workflowDispatch,
            webhook: {
              verified: verification.enabled,
              type: "agentmail",
              eventType: agentMail.type,
            },
            packs: packContext,
            noSendsMode: agent.config.safety?.noSends ?? true,
          }, 202);
        }

        if (url.pathname === "/webhooks/mail" && request.method === "POST") {
          const rawBody = await request.text();
          const verification = verifyMailWebhookRequest(request, env);
          if (!verification.ok) {
            return jsonResponse({
              ok: false,
              error: "unauthorized_mail_webhook",
              detail: "Mail webhook secret was configured but not provided or did not verify.",
            }, 401);
          }
          const parsed = parseJsonText(rawBody);
          const record = isRecord(parsed) ? parsed : {};
          const mailEvent = readMailWebhook(record);
          if (mailEvent.kind === "bounce" || mailEvent.kind === "rejected") {
            const eventSink = createTrellisEventSink(env);
            await emitTrellisTrace(eventSink, {
              id: `trace_event_mail_${normalizeIdPart(mailEvent.kind)}_${normalizeIdPart(mailEvent.providerMessageId ?? String(Date.now()))}`,
              traceId: readString(record.traceId) ?? readString(record.trace_id) ?? `trace_mail_${normalizeIdPart(mailEvent.providerMessageId ?? String(Date.now()))}`,
              span: "mail:lifecycle",
              type: mailEvent.kind === "bounce" ? "mail.bounce" : "mail.rejected",
              message: mailEvent.kind === "bounce" ? "Mail bounce recorded." : "Mail rejection recorded.",
              payload: {
                providerMessageId: mailEvent.providerMessageId,
                providerThreadId: mailEvent.providerThreadId,
                recipient: mailEvent.from,
                reason: mailEvent.reason,
                severity: mailEvent.severity,
              },
            });
            return jsonResponse({
              ok: true,
              accepted: true,
              mode: "lifecycle",
              event: mailEvent,
              webhook: {
                verified: verification.enabled,
                type: "mail",
              },
            }, 202);
          }
          if (!mailEvent.providerThreadId || !mailEvent.bodyText) {
            return jsonResponse({
              ok: true,
              ignored: true,
              reason: "threadId or bodyText missing",
              webhook: {
                verified: verification.enabled,
                type: "mail",
              },
            });
          }

          const signal = mailWebhookToSignal(mailEvent, record);
          const packContext = await readPackContext(env);
          const eventSink = createTrellisEventSink(env);
          const harness = await createRuntimeHarness(env, agent.config, {
            signal,
            packs: packContext,
            eventSink,
          });
          const run = await runTrellisAgent(agent, {
            signal,
            context: {
              packs: packContext,
              inboundReply: mailEvent,
            },
            harness,
            eventSink,
          });
          const persistence = await persistRuntimeResult(env, run, agent.config);
          const queue = await enqueueRuntimeEvent(env, run);
          const workflowDispatch = await dispatchWorkflow(env, run);
          return jsonResponse({
            ok: true,
            accepted: true,
            mode: "processed",
            traceId: traceIdForSignal(run.signal),
            signal: run.signal,
            prospects: run.prospects,
            drafts: run.drafts,
            approvals: run.approvals,
            auditEvents: run.auditEvents,
            persistence,
            queue,
            workflowDispatch,
            webhook: {
              verified: verification.enabled,
              type: "mail",
              eventType: mailEvent.type,
            },
            packs: packContext,
            noSendsMode: agent.config.safety?.noSends ?? true,
          }, 202);
        }

        const approvalDecision = matchApprovalDecisionRoute(url.pathname);
        if (approvalDecision && request.method === "POST") {
          const body = await readJsonBody(request);
          const record = isRecord(body) ? body : {};
          const decision = await recordApprovalDecision(env, {
            approvalId: approvalDecision.approvalId,
            traceId: readString(record.traceId) ?? readString(record.trace_id),
            signalId: readString(record.signalId) ?? `approval:${approvalDecision.approvalId}`,
            status: approvalDecision.status,
            action: readString(record.action) ?? inferApprovalAction(approvalDecision.approvalId),
            draftId: readString(record.draftId) ?? inferApprovalDraftId(approvalDecision.approvalId),
            actor: readString(record.actor),
            reason: readString(record.reason),
          }, agent.config);
          return jsonResponse({
            ok: true,
            approval: {
              id: approvalDecision.approvalId,
              status: approvalDecision.status,
            },
            ...decision,
          });
        }

        if (url.pathname === "/provider-actions") {
          return jsonResponse({
            ok: true,
            snapshot: await readRuntimeSnapshot(env),
          });
        }

        if (url.pathname === "/events") {
          return handleTraceEventsRequest(url, env);
        }

        if (url.pathname === "/events/stream") {
          return handleTraceEventStream(request, url, env);
        }

        const providerActionExecution = matchProviderActionExecutionRoute(url.pathname);
        if (providerActionExecution && request.method === "POST") {
          const body = await readJsonBody(request);
          const record = isRecord(body) ? body : {};
          const execution = await executeProviderAction(env, {
            providerActionId: providerActionExecution.providerActionId,
            actor: readString(record.actor),
            reason: readString(record.reason),
            input: isRecord(record.input) ? record.input : record,
          }, agent.config);
          return jsonResponse(execution.body, execution.status);
        }

        const providerActionTransition = matchProviderActionTransitionRoute(url.pathname);
        if (providerActionTransition && request.method === "POST") {
          const body = await readJsonBody(request);
          const record = isRecord(body) ? body : {};
          const transition = await recordProviderActionTransition(env, {
            providerActionId: providerActionTransition.providerActionId,
            traceId: readString(record.traceId) ?? readString(record.trace_id),
            signalId: readString(record.signalId) ?? `provider-action:${providerActionTransition.providerActionId}`,
            status: providerActionTransition.status,
            actor: readString(record.actor),
            reason: readString(record.reason),
          });
          return jsonResponse({
            ok: true,
            providerAction: {
              id: providerActionTransition.providerActionId,
              status: providerActionTransition.status,
            },
            ...transition,
          });
        }

        const operatorControl = matchOperatorControlRoute(url.pathname);
        if (operatorControl && request.method === "POST") {
          const body = await readJsonBody(request);
          const record = isRecord(body) ? body : {};
          const result = await recordOperatorControl(env, {
            scope: operatorControl.scope,
            targetId: operatorControl.targetId,
            status: operatorControl.status,
            actor: readString(record.actor) ?? "operator",
            reason: readString(record.reason),
            traceId: readString(record.traceId) ?? readString(record.trace_id),
          });
          return jsonResponse({
            ok: result.persistence.enabled,
            ...result,
          }, result.persistence.enabled ? 200 : 501);
        }

        if (url.pathname === "/operator/controls") {
          return jsonResponse({
            ok: true,
            controls: await readOperatorControls(env),
          });
        }

        const operatorReplay = matchOperatorReplayRoute(url.pathname);
        if (operatorReplay && request.method === "POST") {
          const body = await readJsonBody(request);
          const record = isRecord(body) ? body : {};
          const actor = readString(record.actor) ?? "operator";
          const reason = readString(record.reason);
          if (operatorReplay.kind === "workflow") {
            const replay = await replayWorkflowRun(env, {
              workflowRunId: operatorReplay.id,
              replayId: readString(record.replayId) ?? readString(record.replay_id),
              actor,
              reason,
            });
            return jsonResponse(replay.body, replay.status);
          }

          const replay = await replayProviderAction(env, {
            providerActionId: operatorReplay.id,
            actor,
            reason,
          });
          return jsonResponse(replay.body, replay.status);
        }

        if (url.pathname === "/mcp/trellis") {
          const toolCatalog = describeTrellisMcpTools(env, agent.config);
          const mcpServerName = resolveTrellisMcpServerName(agent);
          return jsonResponse({
            ok: true,
            server: mcpServerName,
            mcp: {
              name: mcpServerName,
              agent: agent.name,
            },
            agent: agent.name,
            snapshot: await readRuntimeSnapshot(env),
            tools: toolCatalog.map((tool) => tool.name),
            toolCatalog,
          });
        }

        if (url.pathname === "/dashboard") {
          return new Response(renderDashboard(agent, await readRuntimeSnapshot(env)), {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        const durableObject = env?.TRELLIS_AGENT as {
          idFromName(name: string): unknown;
          get(id: unknown): { fetch(request: Request): Promise<Response> };
        } | undefined;
        if (url.pathname.startsWith("/agents/") && durableObject) {
          const id = durableObject.idFromName(url.pathname);
          return durableObject.get(id).fetch(request);
        }

        return jsonResponse({
          ok: true,
          agent: agent.name,
          routes: [
            "/healthz",
            "/smoke",
            "/smoke/attio",
            "/webhooks/signals",
            "/webhooks/apify",
            "/webhooks/agentmail",
            "/approvals/:id/approve",
            "/approvals/:id/reject",
            "/provider-actions",
            "/provider-actions/:id/execute",
            "/provider-actions/:id/complete",
            "/provider-actions/:id/fail",
            "/events",
            "/events/stream",
            "/operator/controls",
            "/operator/kill-switch/:enable|disable",
            "/operator/campaigns/:id/:pause|resume",
            "/operator/threads/:id/:pause|resume",
            "/operator/workflows/:id/replay",
            "/operator/provider-actions/:id/replay",
            "/mcp/trellis",
            "/dashboard",
            "/webhooks/slack",
          ],
        });
      },
      async queue(batch: TrellisQueueBatch, env?: Record<string, unknown>) {
        return drainTrellisQueue(batch, env, agent.config);
      },
      async scheduled(controller: unknown, env?: Record<string, unknown>) {
        return sweepTrellisSchedules(env, agent.config, controller);
      },
  };

  return {
    TrellisAgent: TrellisAgentObject,
    ProspectWorkflow: ProspectWorkflowObject,
    worker,
  };
}

async function readDurableAgentSnapshot(state: unknown) {
  const record = isRecord(state) ? state : {};
  const storage = isRecord(record.storage) ? record.storage : null;
  const sql = isRecord(storage?.sql) ? storage.sql : null;
  const snapshot = storage ? await readDurableStorageKey(storage, "trellis:snapshot") : null;
  const memory = storage ? await readDurableStorageKey(storage, "trellis:memory") : null;
  return {
    enabled: Boolean(storage),
    kv: {
      snapshot,
      memory,
    },
    sqlite: {
      enabled: Boolean(sql && typeof sql.exec === "function"),
      tables: sql ? await readDurableSqlRows(sql, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name LIMIT 20") : [],
      memory: sql ? await readDurableSqlRows(sql, "SELECT key, value, updated_at AS updatedAt FROM trellis_agent_memory ORDER BY updated_at DESC LIMIT 20") : [],
    },
  };
}

async function readDurableStorageKey(storage: Record<string, unknown>, key: string) {
  if (typeof storage.get !== "function") {
    return null;
  }
  try {
    return await Promise.resolve((storage.get as (key: string) => unknown)(key));
  } catch {
    return null;
  }
}

async function readDurableSqlRows(sql: Record<string, unknown>, query: string) {
  if (typeof sql.exec !== "function") {
    return [];
  }
  try {
    const result = await Promise.resolve((sql.exec as (query: string) => unknown)(query));
    const rows = await normalizeSqlRows(result);
    return rows.map((row) => normalizeDurableSqlRow(row));
  } catch {
    return [];
  }
}

async function normalizeSqlRows(result: unknown): Promise<Record<string, unknown>[]> {
  if (Array.isArray(result)) {
    return result.filter(isRecord);
  }
  if (isRecord(result)) {
    if (typeof result.toArray === "function") {
      const rows = await Promise.resolve((result.toArray as () => unknown)());
      return Array.isArray(rows) ? rows.filter(isRecord) : [];
    }
    if (Array.isArray(result.results)) {
      return result.results.filter(isRecord);
    }
  }
  if (result && typeof result === "object" && Symbol.iterator in result) {
    return Array.from(result as Iterable<unknown>).filter(isRecord);
  }
  return [];
}

function normalizeDurableSqlRow(row: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = typeof value === "string" && (value.startsWith("{") || value.startsWith("["))
      ? parseJsonValue(value)
      : value;
  }
  return normalized;
}

function summarizeCloudflareBindings(env?: Record<string, unknown>) {
  const bindingNames = [
    "TRELLIS_AGENT",
    "TRELLIS_DB",
    "TRELLIS_PACKS",
    "TRELLIS_ARTIFACTS",
    "TRELLIS_EVENTS",
    "PROSPECT_WORKFLOW",
    "AI",
    "BROWSER",
  ];
  return Object.fromEntries(bindingNames.map((name) => [name, Boolean(env?.[name])]));
}

function summarizeTraceExport(env?: Record<string, unknown>) {
  const binding = isTraceExporterBinding(env?.TRELLIS_TRACE_EXPORTER);
  const generic = Boolean(readString(env?.TRELLIS_TRACE_EXPORT_URL));
  const langfuse = Boolean(readString(env?.LANGFUSE_PUBLIC_KEY) && readString(env?.LANGFUSE_SECRET_KEY));
  const braintrust = Boolean(readString(env?.BRAINTRUST_API_KEY) && readString(env?.BRAINTRUST_PROJECT_ID));
  return {
    enabled: binding || generic || langfuse || braintrust,
    binding,
    generic,
    langfuse,
    braintrust,
  };
}

function summarizeEventStreaming(env?: Record<string, unknown>) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  return {
    enabled: Boolean(db?.prepare),
    endpoint: "/events/stream?traceId=<traceId>",
    replayEndpoint: "/events?traceId=<traceId>&limit=100",
    source: "trellis_trace_events",
  };
}

function summarizeSlackOperator(env?: Record<string, unknown>) {
  return {
    enabled: Boolean(readString(env?.SLACK_BOT_TOKEN) && readString(env?.SLACK_SIGNING_SECRET)),
    defaultChannelConfigured: Boolean(readString(env?.SLACK_DEFAULT_CHANNEL)),
    webhook: "/webhooks/slack",
  };
}

function resolveTrellisMcpServerName(agent: TrellisAgentDefinition<TrellisGtmApp>) {
  return agent.config.mcp?.name?.trim() || "trellis";
}

function describeTrellisMcpTools(env: Record<string, unknown> | undefined, config: TrellisAgentConfig) {
  return createTrellisMcpTools(env, config).map((tool) => ({
    name: tool.name,
    description: tool.description,
    provider: tool.provider,
    operation: tool.operation,
    inputSchema: tool.inputSchema,
    executable: typeof tool.execute === "function",
  }));
}

function createTrellisMcpTools(
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
): TrellisMcpToolDefinition[] {
  const mailProvider = resolveMailProvider(config);
  const researchProvider = resolveResearchProvider(config);
  const browserProvider = resolveBrowserProvider(config);
  const tools: TrellisMcpToolDefinition[] = [
    {
      name: "trellis.health",
      description: "Inspect the Trellis runtime, configured providers, safety policy, and deploy bindings.",
      operation: "trellis.health",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute() {
        return {
          ok: true,
          stack: "trellis-cloudflare",
          providers: {
            crm: config.crm?.id ?? null,
            mail: mailProvider?.id ?? null,
            browser: browserProvider?.id ?? null,
            research: researchProvider?.id ?? null,
          },
          safety: config.safety ?? trellis.safeOutbound(),
          bindings: summarizeCloudflareBindings(env),
          traceExport: summarizeTraceExport(env),
        };
      },
    },
    {
      name: "trellis.smoke",
      description: "Run the safe Trellis fixture smoke workflow without provider side effects.",
      operation: "trellis.smoke",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute() {
        return runTrellisSmoke();
      },
    },
    {
      name: "trellis.smoke.history",
      description: "Inspect durable Trellis smoke run history recorded in the runtime store.",
      operation: "trellis.smoke.history",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "trellis.signal.inspect",
      description: "Inspect recent accepted GTM signals from the runtime projection.",
      operation: "trellis.signal.inspect",
      inputSchema: {
        type: "object",
        properties: {
          signalId: { type: "string" },
          threadId: { type: "string" },
          campaignId: { type: "string" },
        },
        additionalProperties: false,
      },
      async execute() {
        const snapshot = await readRuntimeSnapshot(env);
        return {
          ok: true,
          signals: snapshot.recent?.signals ?? [],
        };
      },
    },
    {
      name: "trellis.workflow.inspect",
      description: "Inspect recent workflow runs, statuses, and persisted params.",
      operation: "trellis.workflow.inspect",
      inputSchema: {
        type: "object",
        properties: {
          workflowRunId: { type: "string" },
          signalId: { type: "string" },
          status: { type: "string" },
        },
        additionalProperties: false,
      },
      async execute() {
        const snapshot = await readRuntimeSnapshot(env);
        return {
          ok: true,
          workflowRuns: snapshot.recent?.workflowRuns ?? [],
        };
      },
    },
    {
      name: "trellis.knowledge.inspect",
      description: "Inspect the mounted knowledge and skill pack metadata available to Trellis skills.",
      operation: "trellis.knowledge.inspect",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      async execute() {
        const snapshot = await readRuntimeSnapshot(env);
        return {
          ok: true,
          packs: snapshot.packs,
        };
      },
    },
    {
      name: "trellis.approval.approve",
      description: "Approve a pending side-effect approval. This is an operator action and is not executable by the hidden agent harness.",
      operation: "trellis.approval.approve",
      inputSchema: {
        type: "object",
        required: ["approvalId"],
        properties: {
          approvalId: { type: "string" },
          actor: { type: "string" },
          reason: { type: "string" },
          action: { type: "string" },
          traceId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.approval.reject",
      description: "Reject a pending side-effect approval. This is an operator action and is not executable by the hidden agent harness.",
      operation: "trellis.approval.reject",
      inputSchema: {
        type: "object",
        required: ["approvalId"],
        properties: {
          approvalId: { type: "string" },
          actor: { type: "string" },
          reason: { type: "string" },
          action: { type: "string" },
          traceId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.providerAction.inspect",
      description: "Inspect recent provider action intents and statuses.",
      operation: "trellis.providerAction.inspect",
      inputSchema: {
        type: "object",
        properties: {
          providerActionId: { type: "string" },
          provider: { type: "string" },
          status: { type: "string" },
        },
        additionalProperties: false,
      },
      async execute() {
        const snapshot = await readRuntimeSnapshot(env);
        return {
          ok: true,
          providerActions: snapshot.recent?.providerActions ?? [],
        };
      },
    },
    {
      name: "trellis.providerAction.execute",
      description: "Execute a queued provider action through the Trellis executor route. This is an operator/runtime action and is not executable by the hidden agent harness.",
      operation: "trellis.providerAction.execute",
      inputSchema: {
        type: "object",
        required: ["providerActionId"],
        properties: {
          providerActionId: { type: "string" },
          actor: { type: "string" },
          input: { type: "object" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.providerAction.complete",
      description: "Record a provider action completion from an external executor.",
      operation: "trellis.providerAction.complete",
      inputSchema: {
        type: "object",
        required: ["providerActionId"],
        properties: {
          providerActionId: { type: "string" },
          actor: { type: "string" },
          reason: { type: "string" },
          traceId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.providerAction.fail",
      description: "Record a provider action failure from an external executor.",
      operation: "trellis.providerAction.fail",
      inputSchema: {
        type: "object",
        required: ["providerActionId"],
        properties: {
          providerActionId: { type: "string" },
          actor: { type: "string" },
          reason: { type: "string" },
          traceId: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.trace.export",
      description: "Inspect optional trace export sinks. trellis_trace_events remains canonical.",
      operation: "trellis.trace.export",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute() {
        return {
          ok: true,
          canonical: "trellis_trace_events",
          traceExport: summarizeTraceExport(env),
        };
      },
    },
    {
      name: "trellis.audit.search",
      description: "Inspect recent audit and trace events for operator review.",
      operation: "trellis.audit.search",
      inputSchema: {
        type: "object",
        properties: {
          traceId: { type: "string" },
          signalId: { type: "string" },
          type: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 20 },
        },
        additionalProperties: false,
      },
      async execute() {
        const snapshot = await readRuntimeSnapshot(env);
        return {
          ok: true,
          auditEvents: snapshot.recent?.auditEvents ?? [],
          traceEvents: snapshot.recent?.traceEvents ?? [],
        };
      },
    },
    {
      name: "trellis.operator.controls",
      description: "Inspect the global kill switch and campaign/thread pause controls.",
      operation: "trellis.operator.controls",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "trellis.operator.killSwitch.enable",
      description: "Enable the global Trellis kill switch before provider side effects or workflow dispatch.",
      operation: "trellis.operator.killSwitch.enable",
      inputSchema: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.operator.killSwitch.disable",
      description: "Disable the global Trellis kill switch.",
      operation: "trellis.operator.killSwitch.disable",
      inputSchema: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.workflow.pause",
      description: "Pause workflow dispatch and provider execution for a campaign or thread.",
      operation: "trellis.workflow.pause",
      inputSchema: {
        type: "object",
        required: ["scope", "targetId"],
        properties: {
          scope: { type: "string", enum: ["campaign", "thread"] },
          targetId: { type: "string" },
          reason: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.workflow.resume",
      description: "Resume workflow dispatch and provider execution for a campaign or thread.",
      operation: "trellis.workflow.resume",
      inputSchema: {
        type: "object",
        required: ["scope", "targetId"],
        properties: {
          scope: { type: "string", enum: ["campaign", "thread"] },
          targetId: { type: "string" },
          reason: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.workflow.replay",
      description: "Replay a stored workflow run through the configured workflow runner.",
      operation: "trellis.workflow.replay",
      inputSchema: {
        type: "object",
        required: ["workflowRunId"],
        properties: {
          workflowRunId: { type: "string" },
          replayId: { type: "string" },
          reason: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      name: "trellis.providerAction.replay",
      description: "Requeue a failed or blocked provider action for retry through TRELLIS_EVENTS.",
      operation: "trellis.providerAction.replay",
      inputSchema: {
        type: "object",
        required: ["providerActionId"],
        properties: {
          providerActionId: { type: "string" },
          reason: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  ];

  if (researchProvider?.id === "firecrawl") {
    tools.push(
      {
        name: "research.search",
        description: "Search the web or news with Firecrawl and return normalized research snippets.",
        provider: "firecrawl",
        operation: "research.search",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            queries: {
              type: "array",
              items: { type: "string" },
              maxItems: 5,
            },
            limit: { type: "number", minimum: 1, maximum: 10 },
            sources: {
              type: "array",
              items: { type: "string", enum: ["web", "images", "news"] },
            },
            categories: {
              type: "array",
              items: { type: "string", enum: ["github", "research", "pdf"] },
            },
            includeDomains: { type: "array", items: { type: "string" } },
            excludeDomains: { type: "array", items: { type: "string" } },
            location: { type: "string" },
            country: { type: "string" },
            tbs: { type: "string" },
            scrapeOptions: { type: "object" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeFirecrawlSearch(env, input);
        },
      },
      {
        name: "research.extract",
        description: "Extract markdown from a URL with Firecrawl for grounded agent context.",
        provider: "firecrawl",
        operation: "research.extract",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeFirecrawlExtract(env, input);
        },
      },
      {
        name: "research.map",
        description: "Map a website with Firecrawl to discover URLs before scraping or crawling.",
        provider: "firecrawl",
        operation: "research.map",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            search: { type: "string" },
            sitemap: { type: "string", enum: ["include", "skip", "only"] },
            includeSubdomains: { type: "boolean" },
            ignoreQueryParameters: { type: "boolean" },
            ignoreCache: { type: "boolean" },
            limit: { type: "number" },
            location: { type: "object" },
            timeout: { type: "number" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeFirecrawlMap(env, input);
        },
      },
    );
  }

  if (researchProvider?.id === "research") {
    tools.push(
      {
        name: "research.map",
        description: "Discover URLs from a site for research workflows.",
        provider: "research",
        operation: "research.map",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            search: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 100 },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "research.map", "links", input, researchProvider);
        },
      },
      {
        name: "research.scrape",
        description: "Scrape a page into normalized research content.",
        provider: "research",
        operation: "research.scrape",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            selector: { type: "string" },
            waitFor: { type: "string" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "research.scrape", "scrape", input, researchProvider);
        },
      },
      {
        name: "research.extract",
        description: "Extract markdown or structured facts from a URL for grounded agent context.",
        provider: "research",
        operation: "research.extract",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            prompt: { type: "string" },
            schema: { type: "object" },
            format: { type: "string", enum: ["markdown", "json"] },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "research.extract", readString(input.format) === "json" ? "json" : "markdown", input, researchProvider);
        },
      },
      {
        name: "research.crawl.start",
        description: "Start an async site crawl for research collection.",
        provider: "research",
        operation: "research.crawl.start",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            limit: { type: "number" },
            maxDepth: { type: "number" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "research.crawl.start", "crawl", input, researchProvider);
        },
      },
    );
  }

  if (browserProvider?.id === "browser") {
    tools.push(
      {
        name: "browser.session.run",
        description: "Run a bounded browser automation task in a stateful session profile.",
        provider: "browser",
        operation: "browser.session.run",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            profile: { type: "string" },
            task: { type: "string" },
            steps: { type: "array", items: { type: "object" } },
            waitFor: { type: "string" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "browser.session.run", "session/run", input, browserProvider);
        },
      },
      {
        name: "browser.interact",
        description: "Interact with a page using a bounded browser profile and action list.",
        provider: "browser",
        operation: "browser.interact",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            profile: { type: "string" },
            prompt: { type: "string" },
            steps: { type: "array", items: { type: "object" } },
            waitFor: { type: "string" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "browser.interact", "interact", input, browserProvider);
        },
      },
      {
        name: "browser.screenshot",
        description: "Capture a screenshot of a web page.",
        provider: "browser",
        operation: "browser.screenshot",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            fullPage: { type: "boolean" },
            waitFor: { type: "string" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "browser.screenshot", "screenshot", input, browserProvider);
        },
      },
      {
        name: "browser.pdf",
        description: "Render a web page as a PDF.",
        provider: "browser",
        operation: "browser.pdf",
        inputSchema: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri" },
            waitFor: { type: "string" },
          },
          additionalProperties: false,
        },
        execute(input) {
          return executeBrowserRunQuickAction(env, "browser.pdf", "pdf", input, browserProvider);
        },
      },
    );
  }

  if (readString(env?.PROSPEO_API_KEY)) {
    tools.push({
      name: "mail.enrich",
      description: "Enrich a prospect with Prospeo and return a verified email when available.",
      provider: "prospeo",
      operation: "mail.enrich",
      inputSchema: {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          fullName: { type: "string" },
          linkedinUrl: { type: "string" },
          email: { type: "string" },
          personId: { type: "string" },
          companyName: { type: "string" },
          companyDomain: { type: "string" },
          companyLinkedinUrl: { type: "string" },
        },
        additionalProperties: false,
      },
      execute(input) {
        return executeProspeoEmailEnrich(env, input);
      },
    });
  }

  return tools;
}

async function createRuntimeHarness(
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
  runtime: {
    signal: Partial<TrellisSignal>;
    packs: unknown;
    eventSink?: TrellisEventSink;
  },
): Promise<TrellisHarnessRuntime | undefined> {
  const explicitHarness = env?.TRELLIS_HARNESS;
  if (isHarnessRuntime(explicitHarness)) {
    return explicitHarness;
  }

  const factory = env?.TRELLIS_RUNTIME_CONTEXT_FACTORY ?? env?.TRELLIS_FLUE_CONTEXT_FACTORY;
  if (typeof factory === "function") {
    const tools = createTrellisMcpTools(env, config);
    const created = await Promise.resolve((factory as (
      input: TrellisRuntimeContextFactoryInput,
    ) => unknown | Promise<unknown>)({
      env,
      config,
      signal: runtime.signal,
      packs: runtime.packs,
      tools,
      eventSink: runtime.eventSink,
    }));
    if (isHarnessRuntime(created)) {
      return created;
    }
    if (isFlueContextLike(created)) {
      return createFlueHarnessRuntime(created, env, config, runtime, tools);
    }
  }

  const flueContext = env?.TRELLIS_FLUE_CONTEXT ?? env?.FLUE_CONTEXT;
  if (isFlueContextLike(flueContext)) {
    return createFlueHarnessRuntime(flueContext, env, config, runtime);
  }

  return undefined;
}

function isHarnessRuntime(value: unknown): value is TrellisHarnessRuntime {
  return typeof value === "object"
    && value !== null
    && "raw" in value
    && "skill" in value
    && typeof (value as { raw?: unknown }).raw === "function"
    && typeof (value as { skill?: unknown }).skill === "function";
}

interface FlueContextLike {
  init(options: Record<string, unknown>): Promise<FlueHarnessLike> | FlueHarnessLike;
  subscribeEvent?(callback: (event: Record<string, unknown>) => void | Promise<void>): () => void;
}

interface FlueHarnessLike {
  session(name?: string): Promise<FlueSessionLike> | FlueSessionLike;
}

interface FlueSessionLike {
  skill(name: string, options?: Record<string, unknown>): Promise<unknown> | unknown;
}

function isFlueContextLike(value: unknown): value is FlueContextLike {
  return typeof value === "object"
    && value !== null
    && "init" in value
    && typeof (value as { init?: unknown }).init === "function";
}

function createFlueHarnessRuntime(
  flue: FlueContextLike,
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
  runtime: {
    signal: Partial<TrellisSignal>;
    packs: unknown;
    eventSink?: TrellisEventSink;
  },
  tools?: TrellisMcpToolDefinition[],
): TrellisHarnessRuntime {
  let harnessPromise: Promise<FlueHarnessLike> | undefined;
  let unsubscribeFlueEvents: (() => void) | undefined;
  async function harness() {
    const model = readString(env?.TRELLIS_MODEL) ?? config.model ?? DEFAULT_TRELLIS_MODEL;
    const initOptions: Record<string, unknown> = {
      model: normalizeFlueModelName(model),
      sandbox: env?.TRELLIS_FLUE_SANDBOX,
      tools: Array.isArray(env?.TRELLIS_MCP_TOOLS)
        ? env.TRELLIS_MCP_TOOLS
        : toFlueTools(tools ?? createTrellisMcpTools(env, config)),
    };
    const cwd = readString(env?.TRELLIS_RUNTIME_CWD) ?? readString(env?.TRELLIS_FLUE_CWD);
    if (cwd) {
      initOptions.cwd = cwd;
    }
    if (!unsubscribeFlueEvents && runtime.eventSink && typeof flue.subscribeEvent === "function") {
      unsubscribeFlueEvents = flue.subscribeEvent((event) => {
        bridgeFlueEventToTrellisTrace(runtime.eventSink, runtime.signal, event).catch(() => undefined);
      });
    }
    harnessPromise ??= Promise.resolve(flue.init(initOptions));
    return harnessPromise;
  }

  return {
    raw: harness,
    async skill(name, input) {
      const session = await (await harness()).session(runtime.signal.threadId);
      const args = {
        signal: runtime.signal,
        packs: runtime.packs,
        trellis: buildTrellisOutputContract(name, input.schema, config.state),
        context: input.context,
        ...(input.args ?? {}),
      };
      return session.skill(name, {
        args,
        role: input.role,
        model: input.model,
        signal: createTrellisSkillTimeoutSignal(env),
        ...(input.schema ? { schema: zodSchemaToValibot(input.schema) } : {}),
      });
    },
  };
}

function toFlueTools(tools: TrellisMcpToolDefinition[]) {
  return tools
    .filter((tool) => typeof tool.execute === "function")
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      provider: tool.provider,
      operation: tool.operation,
      parameters: tool.inputSchema ?? {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      async execute(input: Record<string, unknown>) {
        const result = await tool.execute!(input);
        return typeof result === "string" ? result : JSON.stringify(result, null, 2);
      },
    }));
}

function normalizeFlueModelName(model: string) {
  if (model.startsWith("cloudflare/")) {
    return model;
  }
  if (model.startsWith("@cf/") || model.startsWith("anthropic/")) {
    return `cloudflare/${model}`;
  }
  return model;
}

function createTrellisSkillTimeoutSignal(env: Record<string, unknown> | undefined) {
  const timeoutMs = readNumber(env?.TRELLIS_SKILL_TIMEOUT_MS) ?? 60_000;
  if (timeoutMs <= 0) {
    return undefined;
  }
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function buildTrellisOutputContract(
  skillName: string,
  schema: z.ZodTypeAny | undefined,
  state: TrellisStateMap | undefined,
) {
  const contract: Record<string, unknown> = {
    instruction: schema
      ? `Return the ${skillName} result with the typed finish tool. The JSON must match output.schema and will be validated before workflow/state writes.`
      : `Return the ${skillName} result as concise JSON when the skill produces structured data.`,
  };
  if (schema) {
    contract.output = {
      schema: zodSchemaToJsonSchema(schema),
    };
  }
  if (state) {
    contract.database = {
      engine: "cloudflare-d1",
      projectionTable: "trellis_state_records",
      tables: buildStateMapJsonSchemas(state),
    };
  }
  return contract;
}

function zodSchemaToValibot(schema: z.ZodTypeAny): v.GenericSchema {
  const typeName = schema._def?.typeName;
  if (typeName === z.ZodFirstPartyTypeKind.ZodObject) {
    const shape = typeof schema._def.shape === "function" ? schema._def.shape() : schema._def.shape;
    return v.object(Object.fromEntries(
      Object.entries(shape as Record<string, z.ZodTypeAny>).map(([key, value]) => [
        key,
        zodSchemaToValibot(value),
      ]),
    ));
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodString) {
    const checks = Array.isArray(schema._def.checks) ? schema._def.checks : [];
    const min = checks.find((check: { kind?: string; value?: number }) => check.kind === "min")?.value;
    return typeof min === "number" ? v.pipe(v.string(), v.minLength(min)) : v.string();
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodNumber) {
    const checks = Array.isArray(schema._def.checks) ? schema._def.checks : [];
    let current: v.GenericSchema = v.number();
    const min = checks.find((check: { kind?: string; value?: number }) => check.kind === "min")?.value;
    const max = checks.find((check: { kind?: string; value?: number }) => check.kind === "max")?.value;
    if (typeof min === "number") {
      current = v.pipe(current as v.NumberSchema<undefined>, v.minValue(min));
    }
    if (typeof max === "number") {
      current = v.pipe(current as v.NumberSchema<undefined>, v.maxValue(max));
    }
    return current;
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodBoolean) {
    return v.boolean();
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodEnum) {
    return v.picklist(schema._def.values as [string, ...string[]]);
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodArray) {
    return v.array(zodSchemaToValibot(schema._def.type));
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodDefault) {
    return v.optional(zodSchemaToValibot(schema._def.innerType));
  }
  if (typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
    return v.optional(zodSchemaToValibot(schema._def.innerType));
  }
  return v.unknown();
}

function zodSchemaToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, {
    $refStrategy: "none",
  });
  return stripJsonSchemaMeta(asPlainRecord(jsonSchema) ?? {
    type: "object",
    properties: {},
    additionalProperties: false,
  });
}

function buildStateMapJsonSchemas(state: TrellisStateMap) {
  return Object.fromEntries(
    Object.entries(state.tables).map(([tableName, table]) => [
      tableName,
      {
        primaryKey: table.primaryKey,
        row: stateTableToJsonSchema(table),
        indexes: table.indexes ?? [],
        relationships: table.relationships ?? {},
      },
    ]),
  );
}

function stateTableToJsonSchema(table: TrellisStateTableDefinition): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required = new Set<string>();
  if (table.primaryKey in table.fields) {
    required.add(table.primaryKey);
  }

  for (const [fieldName, definition] of Object.entries(table.fields)) {
    const source = typeof definition === "string" ? definition : definition.source;
    const type = typeof definition === "string" ? "string" : definition.type ?? "string";
    if (typeof definition !== "string" && definition.required) {
      required.add(fieldName);
    }
    properties[fieldName] = {
      ...stateFieldTypeJsonSchema(type),
      "x-trellis-source": source,
    };
  }

  return {
    type: "object",
    properties,
    required: [...required],
    additionalProperties: false,
  };
}

function stateFieldTypeJsonSchema(type: TrellisStateFieldType): Record<string, unknown> {
  if (type === "number") {
    return { type: "number" };
  }
  if (type === "boolean") {
    return { type: "boolean" };
  }
  if (type === "json") {
    return {};
  }
  return { type: "string" };
}

function stripJsonSchemaMeta(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...schema };
  delete copy.$schema;
  return copy;
}

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

async function processRuntimeSignals(
  agent: TrellisAgentDefinition<TrellisGtmApp>,
  env: Record<string, unknown> | undefined,
  signals: Array<Partial<TrellisSignal>>,
  context: Record<string, unknown> = {},
) {
  const packContext = await readPackContext(env);
  const eventSink = createTrellisEventSink(env);
  const providerRun = await recordSignalProviderRunStarted(env, signals);
  const results: Array<{
    run: TrellisRuntimeResult;
    persistence: Awaited<ReturnType<typeof persistRuntimeResult>>;
    queue: Awaited<ReturnType<typeof enqueueRuntimeEvent>>;
    workflowDispatch: Awaited<ReturnType<typeof dispatchWorkflow>>;
  }> = [];
  for (const signal of signals) {
    const harness = await createRuntimeHarness(env, agent.config, {
      signal,
      packs: packContext,
      eventSink,
    });
    const run = await runTrellisAgent(agent, {
      signal,
      context: {
        packs: packContext,
        ...context,
      },
      harness,
      eventSink,
      providerRun: {
        id: providerRun.id,
        provider: providerRun.provider,
        kind: providerRun.kind,
        externalId: providerRun.externalId,
        signalsReceived: signals.length,
      },
    });
    const persistence = await persistRuntimeResult(env, run, agent.config);
    const queue = await enqueueRuntimeEvent(env, run);
    const workflowDispatch = await dispatchWorkflow(env, run);
    results.push({
      run,
      persistence,
      queue,
      workflowDispatch,
    });
  }
  const completedProviderRun = await recordSignalProviderRunCompleted(env, providerRun, results);
  return {
    packContext,
    providerRun: completedProviderRun,
    results,
  };
}

function renderProcessedSignalResponse(input: {
  packContext: unknown;
  providerRun: Awaited<ReturnType<typeof recordSignalProviderRunCompleted>>;
  results: Array<{
    run: TrellisRuntimeResult;
    persistence: Awaited<ReturnType<typeof persistRuntimeResult>>;
    queue: Awaited<ReturnType<typeof enqueueRuntimeEvent>>;
    workflowDispatch: Awaited<ReturnType<typeof dispatchWorkflow>>;
  }>;
  webhook: Record<string, unknown>;
  noSendsMode: boolean;
}) {
  const { packContext, providerRun, results, webhook, noSendsMode } = input;
  if (results.length === 1) {
    const result = results[0]!;
    const run = result.run;
    return {
      ok: true,
      accepted: true,
      mode: "processed",
      traceId: traceIdForSignal(run.signal),
      signal: run.signal,
      prospects: run.prospects,
      drafts: run.drafts,
      approvals: run.approvals,
      auditEvents: run.auditEvents,
      persistence: result.persistence,
      queue: result.queue,
      workflowDispatch: result.workflowDispatch,
      providerRun,
      webhook: {
        ...webhook,
        idempotencyKey: run.signal.idempotencyKey ?? null,
      },
      packs: packContext,
      noSendsMode,
    };
  }

  return {
    ok: true,
    accepted: true,
    mode: "processed_batch",
    signalsReceived: results.length,
    signals: results.map((result) => result.run.signal),
    traceIds: results.map((result) => traceIdForSignal(result.run.signal)),
    prospects: results.flatMap((result) => result.run.prospects),
    drafts: results.flatMap((result) => result.run.drafts),
    approvals: results.flatMap((result) => result.run.approvals),
    auditEvents: results.flatMap((result) => result.run.auditEvents),
    persistence: {
      enabled: results.every((result) => result.persistence.enabled),
      results: results.map((result) => result.persistence),
    },
    queue: {
      enabled: results.some((result) => result.queue.enabled),
      messages: results.reduce((total, result) => total + (readNumber(result.queue.messages) ?? 0), 0),
      results: results.map((result) => result.queue),
    },
    workflowDispatch: {
      enabled: results.some((result) => result.workflowDispatch.enabled),
      ok: results.every((result) => result.workflowDispatch.ok !== false),
      results: results.map((result) => result.workflowDispatch),
    },
    providerRun,
    webhook,
    packs: packContext,
    noSendsMode,
  };
}

async function readSignalsFromRequest(request: Request): Promise<Array<Partial<TrellisSignal>>> {
  const payload = await readJsonBody(request);
  const record = isRecord(payload) ? payload : {};
  const signalRecord = isRecord(record.signal) ? record.signal : undefined;
  const rawBatch = Array.isArray(record.signals)
    ? record.signals.filter(isRecord)
    : undefined;
  const rawSignals = rawBatch?.length
    ? rawBatch
    : signalRecord
      ? [signalRecord]
      : [record];
  const rootIdempotencyKey = readString(request.headers.get("idempotency-key"))
    ?? readString(request.headers.get("x-trellis-idempotency-key"))
    ?? readFirstString(record, signalRecord ?? {}, ["idempotencyKey", "idempotency_key"]);

  return rawSignals.map((rawSignal, index) =>
    normalizeSignalWebhookRecord({
      request,
      root: record,
      rawSignal,
      index,
      total: rawSignals.length,
      rootIdempotencyKey,
      nested: Boolean(signalRecord || rawBatch),
    }),
  );
}

async function readApifyWebhook(
  record: Record<string, unknown>,
  request: Request,
  env: Record<string, unknown> | undefined,
) {
  const resource = isRecord(record.resource) ? record.resource : {};
  const payload = isRecord(record.payload) ? record.payload : {};
  const eventType = readFirstString(record, resource, ["eventType", "event_type", "type"])
    ?? readFirstString(payload, record, ["eventType", "event_type", "type"])
    ?? "";
  const actorRunId = readFirstString(record, resource, ["actorRunId", "actor_run_id", "runId", "run_id", "id"])
    ?? readFirstString(payload, record, ["actorRunId", "actor_run_id", "runId", "run_id"]);
  const datasetId = readFirstString(record, resource, ["defaultDatasetId", "defaultDataset_id", "datasetId", "dataset_id"])
    ?? readFirstString(payload, record, ["defaultDatasetId", "defaultDataset_id", "datasetId", "dataset_id"]);
  const source = readFirstString(record, payload, ["source"]) ?? "linkedin_public_post";
  const campaignId = readFirstString(record, payload, ["campaignId", "campaign_id", "campaign"]);
  const workspaceId = readFirstString(record, payload, ["workspaceId", "workspace_id", "workspace"]);
  const term = readFirstString(record, payload, ["term", "query", "keyword", "search"]);

  if (!eventType.includes("SUCCEEDED")) {
    return {
      ok: true as const,
      ignored: true as const,
      reason: `unsupported event type ${eventType || "unknown"}`,
      eventType,
      actorRunId,
      datasetId,
    };
  }

  const inlineItems = readApifyWebhookItems(record);
  const fetched = inlineItems.length === 0 && datasetId
    ? await fetchApifyDatasetItems(env, datasetId, source)
    : { ok: true as const, items: inlineItems, fetchedDataset: false };
  if (!fetched.ok) {
    return {
      ok: false as const,
      status: 502,
      error: "apify_dataset_fetch_failed",
      detail: fetched.detail,
    };
  }

  const rootIdempotencyKey = actorRunId ?? datasetId;
  const root = {
    ...record,
    provider: "apify",
    source,
    externalId: actorRunId,
    actorRunId,
    defaultDatasetId: datasetId,
    campaignId,
    workspaceId,
    term,
  };
  const signals = fetched.items.map((item, index) =>
    normalizeSignalWebhookRecord({
      request,
      root,
      rawSignal: normalizeApifySignalItem(item, {
        actorRunId,
        datasetId,
        source,
        campaignId,
        workspaceId,
        term,
        index,
      }),
      index,
      total: fetched.items.length,
      rootIdempotencyKey,
      nested: true,
    }),
  );

  return {
    ok: true as const,
    ignored: false as const,
    eventType,
    actorRunId,
    datasetId,
    source,
    campaignId,
    workspaceId,
    term,
    fetchedDataset: fetched.fetchedDataset,
    signals,
  };
}

function readApifyWebhookItems(record: Record<string, unknown>) {
  const resource = isRecord(record.resource) ? record.resource : {};
  const payload = isRecord(record.payload) ? record.payload : {};
  return readRecordArray(record, ["items", "signals", "datasetItems", "dataset_items"])
    ?? readRecordArray(payload, ["items", "signals", "datasetItems", "dataset_items"])
    ?? readRecordArray(resource, ["items", "signals", "datasetItems", "dataset_items"])
    ?? [];
}

function readRecordArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }
  return null;
}

async function fetchApifyDatasetItems(
  env: Record<string, unknown> | undefined,
  datasetId: string,
  source: string,
) {
  const apiToken = readString(env?.APIFY_TOKEN);
  if (!apiToken) {
    return {
      ok: false as const,
      detail: "APIFY_TOKEN is required to fetch Apify dataset items when the webhook does not include inline items.",
    };
  }

  const baseUrl = (readString(env?.APIFY_BASE_URL) ?? "https://api.apify.com/v2").replace(/\/+$/, "");
  const limit = readNumber(env?.APIFY_DATASET_LIMIT)
    ?? readNumber(source === "x_public_post" ? env?.APIFY_X_DATASET_LIMIT : env?.APIFY_LINKEDIN_DATASET_LIMIT)
    ?? 50;
  const url = new URL(`${baseUrl}/datasets/${encodeURIComponent(datasetId)}/items`);
  url.searchParams.set("clean", "true");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 500))));

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${apiToken}`,
    },
  });
  if (!response.ok) {
    return {
      ok: false as const,
      detail: `Apify dataset ${datasetId} fetch failed with ${response.status}.`,
    };
  }
  const json = await response.json();
  return {
    ok: true as const,
    items: Array.isArray(json) ? json.filter(isRecord) : [],
    fetchedDataset: true,
  };
}

function normalizeApifySignalItem(
  item: Record<string, unknown>,
  metadata: {
    actorRunId?: string;
    datasetId?: string;
    source: string;
    campaignId?: string;
    workspaceId?: string;
    term?: string;
    index: number;
  },
) {
  const author = isRecord(item.author) ? item.author : {};
  const header = isRecord(item.header) ? item.header : {};
  const socialContent = isRecord(item.socialContent) ? item.socialContent : {};
  const url = readFirstString(item, socialContent, ["url", "postUrl", "linkedinUrl", "sourceUrl", "link", "shareUrl"])
    ?? `https://apify.invalid/dataset/${normalizeIdPart(metadata.datasetId ?? "inline")}/${metadata.index + 1}`;
  const authorName = readFirstString(item, author, ["authorName", "name", "fullName", "author"])
    ?? "Unknown";
  const authorTitle = readFirstString(item, author, ["authorTitle", "jobTitle", "title", "headline", "info", "description"])
    ?? readFirstString(header, {}, ["text"]);
  const content = readFirstString(item, socialContent, ["content", "text", "postText", "description", "body", "summary"])
    ?? "";
  const topic = metadata.term
    ?? readFirstString(item, {}, ["topic", "query", "keyword", "search"])
    ?? metadata.source;
  return {
    ...item,
    provider: "apify",
    source: metadata.source,
    externalId: metadata.actorRunId,
    actorRunId: metadata.actorRunId,
    datasetId: metadata.datasetId,
    campaignId: metadata.campaignId,
    workspaceId: metadata.workspaceId,
    term: metadata.term,
    sourceRef: readSignalSourceRef(metadata.source, item, metadata.index),
    url,
    authorName,
    authorTitle,
    authorCompany: readFirstString(item, author, ["authorCompany", "company", "companyName", "currentCompanyName"]),
    companyDomain: readFirstString(item, author, ["companyDomain", "domain", "website", "companyWebsite"]),
    topic,
    content,
    metadata: {
      apify: {
        actorRunId: metadata.actorRunId,
        datasetId: metadata.datasetId,
        source: metadata.source,
        term: metadata.term,
      },
      raw: item,
    },
  };
}

function normalizeSignalWebhookRecord(input: {
  request: Request;
  root: Record<string, unknown>;
  rawSignal: Record<string, unknown>;
  index: number;
  total: number;
  rootIdempotencyKey?: string;
  nested: boolean;
}): Partial<TrellisSignal> {
  const { request, root, rawSignal, index, total, rootIdempotencyKey, nested } = input;
  const provider = readFirstString(rawSignal, root, ["provider"]) ?? "webhook";
  const source = readFirstString(rawSignal, root, ["source"]) ?? "webhook.signals";
  const sourceRef = readSignalSourceRef(source, rawSignal, index);
  const explicitId = readFirstString(rawSignal, root, ["id", "signalId", "signal_id"]);
  const batchIdempotencyKey = rootIdempotencyKey && total > 1
    ? `${rootIdempotencyKey}:${sourceRef}`
    : rootIdempotencyKey;
  const idempotencyKey = readFirstString(rawSignal, root, ["idempotencyKey", "idempotency_key"])
    ?? batchIdempotencyKey;
  const signalId = explicitId
    ?? (idempotencyKey ? `sig_${normalizeIdPart(idempotencyKey)}` : undefined)
    ?? `sig_${normalizeIdPart(`${provider}_${source}_${sourceRef}`)}`;
  const traceId = readString(request.headers.get("traceparent"))
    ?? readString(request.headers.get("x-trellis-trace-id"))
    ?? readFirstString(rawSignal, root, ["traceId", "trace_id"])
    ?? `trace_${normalizeIdPart(signalId)}`;
  const workspaceId = readFirstString(rawSignal, root, ["workspaceId", "workspace_id", "workspace"]) ?? "wrk_default";
  const campaignId = readFirstString(rawSignal, root, ["campaignId", "campaign_id", "campaign"]);
  const payload = normalizedSignalPayload({
    root,
    rawSignal,
    provider,
    source,
    sourceRef,
    nested,
    index,
    total,
  });
  return {
    id: signalId,
    traceId,
    threadId: readFirstString(rawSignal, root, ["threadId", "thread_id", "thread"]) ?? `thr_${normalizeIdPart(signalId)}`,
    workspaceId,
    campaignId,
    idempotencyKey,
    provider,
    source,
    payload,
  };
}

function normalizedSignalPayload(input: {
  root: Record<string, unknown>;
  rawSignal: Record<string, unknown>;
  provider: string;
  source: string;
  sourceRef: string;
  nested: boolean;
  index: number;
  total: number;
}) {
  const { root, rawSignal, provider, source, sourceRef, nested, index, total } = input;
  const metadata = isRecord(root.metadata) ? root.metadata : {};
  const signalMetadata = isRecord(rawSignal.metadata) ? rawSignal.metadata : {};
  const url = readFirstString(rawSignal, root, ["url", "postUrl", "sourceUrl", "link", "linkedinUrl"]);
  const content = readFirstString(rawSignal, root, ["content", "text", "body", "description", "excerpt", "summary"]);
  const topic = readFirstString(rawSignal, root, ["topic", "title", "query", "keyword"]) ?? source;
  return {
    ...(nested ? {} : root),
    ...rawSignal,
    provider,
    source,
    sourceRef,
    url,
    authorName: readFirstString(rawSignal, root, ["authorName", "name", "author", "fullName"]) ?? "Unknown",
    authorTitle: readFirstString(rawSignal, root, ["authorTitle", "title", "headline", "role"]),
    authorCompany: readFirstString(rawSignal, root, ["authorCompany", "company", "companyName"]),
    companyDomain: readFirstString(rawSignal, root, ["companyDomain", "domain", "website"]),
    topic,
    content: content ?? "",
    capturedAt: readSignalCapturedAt(rawSignal, root),
    metadata: {
      ...metadata,
      ...signalMetadata,
      root: nested ? omitSignalCollections(root) : undefined,
      raw: rawSignal,
      batchIndex: total > 1 ? index : undefined,
      batchSize: total > 1 ? total : undefined,
    },
  };
}

function readSignalSourceRef(source: string, rawSignal: Record<string, unknown>, index: number) {
  return readFirstString(rawSignal, {}, [
    "sourceRef",
    "source_ref",
    "externalId",
    "external_id",
    "id",
    "postId",
    "tweetId",
    "restId",
    "entityId",
    "urn",
    "shareUrn",
    "url",
    "postUrl",
    "sourceUrl",
    "link",
    "linkedinUrl",
  ]) ?? `${normalizeIdPart(source)}_${index + 1}_${stableHashPart(JSON.stringify(rawSignal))}`;
}

function readSignalCapturedAt(primary: Record<string, unknown>, secondary: Record<string, unknown>) {
  const candidate = primary.capturedAt
    ?? primary.captured_at
    ?? primary.timestamp
    ?? primary.publishedAt
    ?? secondary.capturedAt
    ?? secondary.captured_at
    ?? secondary.timestamp
    ?? secondary.publishedAt;
  const numeric = readNumber(candidate);
  if (numeric !== undefined) {
    return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  }
  const asString = readString(candidate);
  if (asString) {
    const parsed = Date.parse(asString);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

function omitSignalCollections(record: Record<string, unknown>) {
  const { signal: _signal, signals: _signals, ...rest } = record;
  return rest;
}

function stableHashPart(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function verifySignalWebhook(request: Request, env: Record<string, unknown> | undefined) {
  const configuredSecret = readString(env?.TRELLIS_WEBHOOK_SECRET)
    ?? readString(env?.SIGNAL_WEBHOOK_SECRET);
  if (!configuredSecret) {
    return {
      enabled: false,
      ok: true,
    };
  }

  const authorization = readString(request.headers.get("authorization"));
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  const providedSecret = readString(request.headers.get("x-trellis-webhook-secret"))
    ?? readString(request.headers.get("x-webhook-secret"))
    ?? bearer;
  return {
    enabled: true,
    ok: providedSecret === configuredSecret,
  };
}

function summarizeRouteAuth(env: Record<string, unknown> | undefined, config: TrellisAgentConfig) {
  const apiKey = resolveApiKeyAuth(config);
  const configured = Boolean(readString(env?.[apiKey.env]));
  return {
    apiKey: {
      enabled: configured,
      env: apiKey.env,
      header: apiKey.header,
      allowUnauthenticated: apiKey.allowUnauthenticated,
      protectedRoutes: [
        "/webhooks/signals",
        "/mcp/trellis",
        "/dashboard",
        "/approvals/*",
        "/operator/*",
        "/provider-actions*",
        "/events*",
        "/agents/*",
      ],
    },
  };
}

function verifyTrellisRouteAuth(
  request: Request,
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
  pathname: string,
) {
  const apiKey = resolveApiKeyAuth(config);
  const configuredSecret = readString(env?.[apiKey.env]);
  if (!configuredSecret || apiKey.allowUnauthenticated.includes(pathname) || !isTrellisApiKeyProtectedRoute(pathname)) {
    return {
      ok: true,
      status: 200,
      error: null,
      detail: null,
    };
  }

  const providedSecret = readTrellisApiKeyFromRequest(request, apiKey.header);
  return providedSecret === configuredSecret
    ? {
        ok: true,
        status: 200,
        error: null,
        detail: null,
      }
    : {
        ok: false,
        status: 401,
        error: "unauthorized",
        detail: `This Trellis route requires a matching bearer token or ${apiKey.header} header.`,
      };
}

function resolveApiKeyAuth(config: TrellisAgentConfig): TrellisApiKeyAuthConfig {
  return config.auth?.apiKey ?? {
    type: "apiKey",
    env: "TRELLIS_API_KEY",
    header: "x-trellis-api-key",
    allowUnauthenticated: ["/healthz", "/smoke"],
  };
}

function isTrellisApiKeyProtectedRoute(pathname: string) {
  return pathname === "/webhooks/signals"
    || pathname === "/mcp/trellis"
    || pathname === "/dashboard"
    || pathname === "/provider-actions"
    || pathname === "/events"
    || pathname === "/events/stream"
    || pathname.startsWith("/provider-actions/")
    || pathname.startsWith("/approvals/")
    || pathname.startsWith("/operator/")
    || pathname.startsWith("/agents/");
}

function readTrellisApiKeyFromRequest(request: Request, headerName: string) {
  const authorization = readString(request.headers.get("authorization"));
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  return bearer
    ?? readString(request.headers.get(headerName))
    ?? readString(request.headers.get("x-trellis-api-key"));
}

function verifyApifyWebhookRequest(request: Request, env: Record<string, unknown> | undefined) {
  const configuredSecret = readString(env?.APIFY_WEBHOOK_SECRET)
    ?? readString(env?.TRELLIS_WEBHOOK_SECRET)
    ?? readString(env?.SIGNAL_WEBHOOK_SECRET);
  if (!configuredSecret) {
    return {
      enabled: false,
      ok: true,
    };
  }

  const url = new URL(request.url);
  const authorization = readString(request.headers.get("authorization"));
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  const providedSecret = readString(request.headers.get("x-apify-webhook-secret"))
    ?? readString(request.headers.get("x-trellis-webhook-secret"))
    ?? readString(request.headers.get("x-webhook-secret"))
    ?? readString(url.searchParams.get("secret"))
    ?? bearer;
  return {
    enabled: true,
    ok: providedSecret === configuredSecret,
  };
}

async function verifyAgentMailWebhookRequest(
  rawBody: string,
  request: Request,
  env: Record<string, unknown> | undefined,
) {
  const configuredSecret = readString(env?.AGENTMAIL_WEBHOOK_SECRET);
  if (!configuredSecret) {
    return {
      enabled: false,
      ok: true,
    };
  }

  const verifier = env?.TRELLIS_AGENTMAIL_WEBHOOK_VERIFIER;
  if (typeof verifier === "function") {
    const ok = await Promise.resolve((verifier as (
      rawBody: string,
      headers: Record<string, string>,
      secret: string,
    ) => boolean | Promise<boolean>)(rawBody, Object.fromEntries(request.headers.entries()), configuredSecret));
    return {
      enabled: true,
      ok,
    };
  }

  const authorization = readString(request.headers.get("authorization"));
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  const providedSecret = readString(request.headers.get("x-agentmail-webhook-secret"))
    ?? readString(request.headers.get("x-trellis-webhook-secret"))
    ?? bearer;
  return {
    enabled: true,
    ok: providedSecret === configuredSecret,
  };
}

function verifyMailWebhookRequest(request: Request, env: Record<string, unknown> | undefined) {
  const configuredSecret = readString(env?.TRELLIS_MAIL_WEBHOOK_SECRET)
    ?? readString(env?.MAIL_WEBHOOK_SECRET)
    ?? readString(env?.TRELLIS_WEBHOOK_SECRET)
    ?? readString(env?.SIGNAL_WEBHOOK_SECRET);
  if (!configuredSecret) {
    return {
      enabled: false,
      ok: true,
    };
  }

  const url = new URL(request.url);
  const authorization = readString(request.headers.get("authorization"));
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  const providedSecret = readString(request.headers.get("x-trellis-mail-webhook-secret"))
    ?? readString(request.headers.get("x-mail-webhook-secret"))
    ?? readString(request.headers.get("x-trellis-webhook-secret"))
    ?? readString(request.headers.get("x-webhook-secret"))
    ?? readString(url.searchParams.get("secret"))
    ?? bearer;
  return {
    enabled: true,
    ok: providedSecret === configuredSecret,
  };
}

function verifyProviderSmokeRequest(request: Request, env: Record<string, unknown> | undefined) {
  const configuredSecret = readString(env?.TRELLIS_PROVIDER_SMOKE_TOKEN)
    ?? readString(env?.TRELLIS_MCP_TOKEN)
    ?? readString(env?.TRELLIS_SANDBOX_TOKEN);
  if (!configuredSecret) {
    return {
      ok: false,
      status: 403,
      error: "provider_smoke_token_required",
      detail: "Configure TRELLIS_PROVIDER_SMOKE_TOKEN before enabling provider smoke writes.",
    };
  }

  const authorization = readString(request.headers.get("authorization"));
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : undefined;
  const providedSecret = bearer
    ?? readString(request.headers.get("x-trellis-provider-smoke-token"))
    ?? readString(request.headers.get("x-trellis-smoke-token"));
  return providedSecret === configuredSecret
    ? {
        ok: true,
        status: 200,
        error: null,
        detail: null,
      }
    : {
        ok: false,
        status: 401,
        error: "unauthorized_provider_smoke",
        detail: "Provider smoke writes require a matching bearer token or x-trellis-provider-smoke-token header.",
      };
}

function providerSmokeFailureStatus(smoke: TrellisProviderSmokeResult) {
  if (smoke.error?.includes("ATTIO_API_KEY")) {
    return 424;
  }
  return 502;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function parseJsonText(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function readAgentMailWebhook(record: Record<string, unknown>) {
  const message = isRecord(record.message) ? record.message : {};
  const thread = isRecord(record.thread) ? record.thread : {};
  const payload = isRecord(record.payload) ? record.payload : {};
  const type = readFirstString(record, payload, ["event_type", "eventType", "type"]) ?? "";
  const providerInboxId = readFirstString(message, thread, ["inbox_id", "inboxId"])
    ?? readFirstString(payload, record, ["inbox_id", "inboxId"]);
  const providerThreadId = readFirstString(message, thread, ["thread_id", "threadId"])
    ?? readFirstString(payload, record, ["thread_id", "threadId"]);
  const providerMessageId = readFirstString(message, record, ["message_id", "messageId", "id"])
    ?? readFirstString(payload, record, ["message_id", "messageId"]);
  const subject = readFirstString(message, thread, ["subject"])
    ?? readFirstString(payload, record, ["subject"]);
  const bodyText = readFirstString(message, record, ["text", "extracted_text", "preview", "bodyText", "body_text"])
    ?? readFirstString(payload, record, ["text", "bodyText", "body_text"]);
  return {
    type,
    providerInboxId,
    providerThreadId,
    providerMessageId,
    subject,
    bodyText,
  };
}

function agentMailWebhookToSignal(
  agentMail: ReturnType<typeof readAgentMailWebhook>,
  raw: Record<string, unknown>,
): Partial<TrellisSignal> {
  const idPart = agentMail.providerMessageId ?? agentMail.providerThreadId ?? String(Date.now());
  const signalId = `sig_agentmail_${normalizeIdPart(idPart)}`;
  return {
    id: signalId,
    traceId: readString(raw.traceId) ?? readString(raw.trace_id) ?? `trace_${normalizeIdPart(signalId)}`,
    threadId: `agentmail_${normalizeIdPart(agentMail.providerThreadId ?? idPart)}`,
    workspaceId: readString(raw.workspaceId) ?? readString(raw.workspace_id) ?? "wrk_default",
    provider: "agentmail",
    source: "reply.webhook",
    payload: {
      ...raw,
      provider: "agentmail",
      source: "reply.webhook",
      eventType: agentMail.type,
      providerInboxId: agentMail.providerInboxId,
      providerThreadId: agentMail.providerThreadId,
      providerMessageId: agentMail.providerMessageId,
      subject: agentMail.subject,
      bodyText: agentMail.bodyText,
    },
  };
}

function readMailWebhook(record: Record<string, unknown>) {
  const message = isRecord(record.message) ? record.message : {};
  const payload = isRecord(record.payload) ? record.payload : {};
  const type = readFirstString(record, payload, ["event_type", "eventType", "type", "kind"]) ?? "message.received";
  const normalizedType = type.toLowerCase();
  const providerThreadId = readFirstString(message, payload, ["thread_id", "threadId", "conversationId", "conversation_id"])
    ?? readFirstString(record, {}, ["thread_id", "threadId", "conversationId", "conversation_id"]);
  const providerMessageId = readFirstString(message, payload, ["message_id", "messageId", "id"])
    ?? readFirstString(record, {}, ["message_id", "messageId", "id"]);
  const subject = readFirstString(message, payload, ["subject"])
    ?? readString(record.subject);
  const bodyText = readFirstString(message, payload, ["text", "bodyText", "body_text", "plain", "preview"])
    ?? readFirstString(record, {}, ["text", "bodyText", "body_text", "body"]);
  const from = readFirstString(message, payload, ["from", "sender", "fromEmail", "from_email"])
    ?? readString(record.from);
  const to = readStringArray(message.to).length > 0
    ? readStringArray(message.to)
    : readStringArray(payload.to).length > 0
      ? readStringArray(payload.to)
      : readStringArray(record.to);
  const reason = readFirstString(message, payload, ["reason", "error", "diagnosticCode", "diagnostic_code"])
    ?? readString(record.reason);
  const kind = normalizedType.includes("bounce")
    ? "bounce"
    : normalizedType.includes("reject")
      ? "rejected"
      : "inbound";
  const severity = normalizedType.includes("hard") ? "hard" : normalizedType.includes("soft") ? "soft" : undefined;
  return {
    type,
    kind,
    providerThreadId,
    providerMessageId,
    subject,
    bodyText,
    from,
    to,
    reason,
    severity,
  };
}

function mailWebhookToSignal(
  mailEvent: ReturnType<typeof readMailWebhook>,
  raw: Record<string, unknown>,
): Partial<TrellisSignal> {
  const idPart = mailEvent.providerMessageId ?? mailEvent.providerThreadId ?? String(Date.now());
  const signalId = `sig_mail_${normalizeIdPart(idPart)}`;
  return {
    id: signalId,
    traceId: readString(raw.traceId) ?? readString(raw.trace_id) ?? `trace_${normalizeIdPart(signalId)}`,
    threadId: `mail_${normalizeIdPart(mailEvent.providerThreadId ?? idPart)}`,
    workspaceId: readString(raw.workspaceId) ?? readString(raw.workspace_id) ?? "wrk_default",
    provider: "mail",
    source: "reply.webhook",
    payload: {
      ...raw,
      provider: "mail",
      source: "reply.webhook",
      eventType: mailEvent.type,
      providerThreadId: mailEvent.providerThreadId,
      providerMessageId: mailEvent.providerMessageId,
      subject: mailEvent.subject,
      bodyText: mailEvent.bodyText,
      from: mailEvent.from,
      to: mailEvent.to,
    },
  };
}

async function recordSignalProviderRunStarted(
  env: Record<string, unknown> | undefined,
  signals: Array<Partial<TrellisSignal>>,
) {
  const descriptor = describeSignalProviderRun(signals);
  const now = new Date().toISOString();
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      ...descriptor,
      status: "running",
      createdAt: now,
    };
  }

  await ensureD1Schema(db);
  await upsertProviderRun(db, {
    ...descriptor,
    status: "running",
    requestPayload: descriptor.requestPayload,
    responsePayload: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  });
  return {
    enabled: true,
    table: "trellis_provider_runs",
    ...descriptor,
    status: "running",
    createdAt: now,
  };
}

async function recordSignalProviderRunCompleted(
  env: Record<string, unknown> | undefined,
  started: Awaited<ReturnType<typeof recordSignalProviderRunStarted>>,
  results: Array<{
    run: TrellisRuntimeResult;
    queue: Awaited<ReturnType<typeof enqueueRuntimeEvent>>;
    workflowDispatch: Awaited<ReturnType<typeof dispatchWorkflow>>;
  }>,
) {
  const workflowFailures = results.filter((result) => result.workflowDispatch.ok === false);
  const status = workflowFailures.length > 0 ? "completed_with_warnings" : "succeeded";
  const responsePayload = {
    itemsSeen: results.length,
    signalsReceived: results.length,
    prospectsProcessed: results.reduce((total, result) => total + result.run.prospects.length, 0),
    draftsCreated: results.reduce((total, result) => total + result.run.drafts.length, 0),
    approvalsCreated: results.reduce((total, result) => total + result.run.approvals.length, 0),
    queueMessages: results.reduce((total, result) => total + (readNumber(result.queue.messages) ?? 0), 0),
    workflowFailures: workflowFailures.map((result) => ({
      signalId: result.run.signal.id,
      error: readString(result.workflowDispatch.error) ?? "workflow dispatch failed",
    })),
  };
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!started.enabled || !db?.prepare) {
    return {
      ...started,
      status,
      responsePayload,
    };
  }

  await ensureD1Schema(db);
  const updatedAt = new Date().toISOString();
  await upsertProviderRun(db, {
    id: started.id,
    provider: started.provider,
    kind: started.kind,
    externalId: started.externalId,
    status,
    requestPayload: started.requestPayload,
    responsePayload,
    error: workflowFailures.length > 0 ? "One or more workflow dispatches failed." : null,
    createdAt: started.createdAt ?? updatedAt,
    updatedAt,
  });
  return {
    ...started,
    status,
    updatedAt,
    responsePayload,
  };
}

function describeSignalProviderRun(signals: Array<Partial<TrellisSignal>>) {
  const first = signals[0] ?? {};
  const providers = uniqueStrings(signals.map((signal) => signal.provider));
  const sources = uniqueStrings(signals.map((signal) => signal.source));
  const provider = providers.length === 1 ? providers[0]! : providers.length > 1 ? "mixed" : "webhook";
  const source = sources.length === 1 ? sources[0]! : sources.length > 1 ? "mixed" : "webhook.signals";
  const externalId = readSignalExternalId(first)
    ?? readString(first.id)
    ?? `${provider}_${source}_${stableHashPart(JSON.stringify(signals.map((signal) => signal.id ?? signal.payload)))}`;
  return {
    id: `provider_run_${normalizeIdPart(provider)}_${normalizeIdPart(externalId)}`,
    provider,
    kind: signals.length > 1 ? "signal.batch" : "signal.webhook",
    externalId,
    requestPayload: {
      source,
      sources,
      signalsReceived: signals.length,
      signalIds: signals.map((signal) => signal.id).filter(Boolean),
      sourceRefs: signals.map((signal) => readString(signal.payload?.sourceRef)).filter(Boolean),
    },
  };
}

function readSignalExternalId(signal: Partial<TrellisSignal>) {
  const payload = signal.payload ?? {};
  const metadata = isRecord(payload.metadata) ? payload.metadata : {};
  const root = isRecord(metadata.root) ? metadata.root : {};
  return readFirstString(payload, root, [
    "externalId",
    "external_id",
    "actorRunId",
    "actor_run_id",
    "runId",
    "run_id",
  ]);
}

function uniqueStrings(values: Array<unknown>) {
  return Array.from(new Set(values.map(readString).filter((value): value is string => Boolean(value))));
}

async function upsertProviderRun(
  db: TrellisD1Database,
  input: {
    id: string;
    provider: string;
    kind: string;
    externalId?: string | null;
    status: string;
    requestPayload: Record<string, unknown>;
    responsePayload: Record<string, unknown> | null;
    error: string | null;
    createdAt: string;
    updatedAt: string;
  },
) {
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_provider_runs
      (id, provider, kind, external_id, status, request_json, response_json, error, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.id,
    input.provider,
    input.kind,
    input.externalId ?? null,
    input.status,
    JSON.stringify(input.requestPayload),
    JSON.stringify(input.responsePayload ?? {}),
    input.error,
    input.createdAt,
    input.updatedAt,
  ]);
}

async function persistRuntimeResult(
  env: Record<string, unknown> | undefined,
  run: TrellisRuntimeResult,
  config?: TrellisAgentConfig,
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      tables: [],
    };
  }

  await ensureD1Schema(db);
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_signals
      (id, workspace_id, thread_id, campaign_id, provider, source, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    run.signal.id,
    run.signal.workspaceId,
    run.signal.threadId,
    run.signal.campaignId ?? null,
    run.signal.provider ?? null,
    run.signal.source ?? null,
    JSON.stringify({
      traceId: traceIdForSignal(run.signal),
      ...(run.signal.payload ?? {}),
    }),
    new Date().toISOString(),
  ]);

  for (const prospect of run.prospects) {
    await runD1(db, `
      INSERT OR REPLACE INTO trellis_prospects
        (id, signal_id, workspace_id, thread_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      prospect.id,
      prospect.signalId,
      prospect.workspaceId,
      prospect.threadId,
      prospect.status,
      new Date().toISOString(),
    ]);
    const stateRecords = buildStateRecords(config?.state, run, prospect);
    for (const stateRecord of stateRecords) {
      await runD1(db, `
        INSERT OR REPLACE INTO trellis_state_records
          (id, entity, record_id, signal_id, workspace_id, thread_id, fields_json, schema_json, indexes_json, relationships_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        stateRecord.id,
        stateRecord.table,
        stateRecord.recordId,
        stateRecord.signalId,
        stateRecord.workspaceId,
        stateRecord.threadId,
        JSON.stringify(stateRecord.fields),
        JSON.stringify(stateRecord.schema),
        JSON.stringify(stateRecord.indexes),
        JSON.stringify(stateRecord.relationships),
        stateRecord.updatedAt,
      ]);
    }
  }

  for (const draft of run.drafts) {
    await runD1(db, `
      INSERT OR REPLACE INTO trellis_drafts
        (id, signal_id, channel, status, approval_required_json, body, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      draft.id,
      run.signal.id,
      draft.channel,
      draft.status,
      JSON.stringify(draft.approvalRequiredFor),
      draft.body,
      new Date().toISOString(),
    ]);
  }

  for (const approval of run.approvals) {
    await runD1(db, `
      INSERT OR REPLACE INTO trellis_approvals
        (id, draft_id, signal_id, action, status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      approval.id,
      approval.draftId,
      approval.signalId,
      approval.action,
      approval.status,
      new Date().toISOString(),
    ]);
  }

  for (const event of run.auditEvents) {
    await runD1(db, `
      INSERT OR REPLACE INTO trellis_audit_events
        (id, signal_id, workflow, type, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      event.id,
      event.signalId ?? run.signal.id,
      event.workflow ?? null,
      event.type,
      event.message,
      new Date().toISOString(),
    ]);
    if (event.type === "signal.accepted") {
      continue;
    }
    const traceEventId = `trace_event_${event.id}`;
    const existingTraceEvent = await db.prepare(`
      SELECT id
      FROM trellis_trace_events
      WHERE id = ?
    `).bind(traceEventId).first<{ id: string }>();
    if (existingTraceEvent) {
      continue;
    }
    await insertTraceEvent(env, db, {
      id: traceEventId,
      traceId: event.traceId ?? traceIdForSignal(run.signal),
      signalId: event.signalId ?? run.signal.id,
      workflow: event.workflow,
      type: event.type,
      span: traceSpanForAuditEvent(event),
      message: event.message,
      payload: event.metadata ?? {},
    });
  }

  return {
    enabled: true,
    tables: ["trellis_signals", "trellis_prospects", "trellis_state_records", "trellis_drafts", "trellis_approvals", "trellis_provider_runs", "trellis_provider_actions", "trellis_workflow_runs", "trellis_operator_controls", "trellis_smoke_runs", "trellis_audit_events", "trellis_trace_events"],
  };
}

function buildStateMapSource(run: TrellisRuntimeResult, prospect: TrellisProspect) {
  const input = workflowInputParams(run);
  const signal = {
    id: run.signal.id,
    traceId: traceIdForSignal(run.signal),
    workspaceId: run.signal.workspaceId,
    threadId: run.signal.threadId,
    campaignId: run.signal.campaignId ?? null,
    provider: run.signal.provider ?? null,
    source: run.signal.source ?? null,
    payload: run.signal.payload ?? {},
  };
  return {
    ...(run.signal.payload ?? {}),
    ...input,
    input,
    signal,
    payload: run.signal.payload ?? {},
    workflow: run.startedWorkflows[0] ?? null,
    prospect,
    result: run.result,
  };
}

function buildStateRecords(
  state: TrellisStateMap | undefined,
  run: TrellisRuntimeResult,
  prospect: TrellisProspect,
) {
  const source = buildStateMapSource(run, prospect);
  const records: Array<{
    id: string;
    table: string;
    recordId: string;
    signalId: string;
    workspaceId: string;
    threadId: string;
    fields: Record<string, unknown>;
    schema: Record<string, unknown>;
    indexes: TrellisStateIndexDefinition[];
    relationships: Record<string, TrellisStateRelationshipDefinition>;
    updatedAt: string;
  }> = [];
  for (const [tableName, table] of Object.entries(state?.tables ?? {})) {
    const fields = applyStateTableFields(table.fields, source);
    const recordId = readStateRecordId(tableName, table, fields, source, prospect, run);
    if (!recordId || Object.keys(fields).length === 0) {
      continue;
    }
    records.push({
      id: `state_${normalizeIdPart(tableName)}_${normalizeIdPart(recordId)}`,
      table: tableName,
      recordId,
      signalId: run.signal.id,
      workspaceId: run.signal.workspaceId,
      threadId: run.signal.threadId,
      fields,
      schema: {
        primaryKey: table.primaryKey,
        fields: table.fields,
        jsonSchema: stateTableToJsonSchema(table),
      },
      indexes: table.indexes ?? [],
      relationships: table.relationships ?? {},
      updatedAt: new Date().toISOString(),
    });
  }
  return records;
}

function applyStateTableFields(fields: TrellisStateFields, source: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const [stateField, definition] of Object.entries(fields)) {
    const sourcePath = typeof definition === "string" ? definition : definition.source;
    const rawValue = readMappedValue(source, sourcePath);
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      continue;
    }
    values[stateField] = typeof definition === "string"
      ? rawValue
      : coerceStateFieldValue(rawValue, definition.type);
  }
  return values;
}

function readStateRecordId(
  tableName: string,
  table: TrellisStateTableDefinition,
  fields: Record<string, unknown>,
  source: Record<string, unknown>,
  prospect: TrellisProspect,
  run: TrellisRuntimeResult,
) {
  const fieldValue = fields[table.primaryKey];
  if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
    return String(fieldValue);
  }
  const sourceValue = readMappedValue(source, table.primaryKey);
  if (sourceValue !== undefined && sourceValue !== null && sourceValue !== "") {
    return String(sourceValue);
  }
  if (tableName === "prospects" || tableName === "prospect") {
    return prospect.id;
  }
  if (tableName === "signals" || tableName === "signal") {
    return run.signal.id;
  }
  return undefined;
}

function coerceStateFieldValue(value: unknown, type: TrellisStateFieldType | undefined) {
  if (type === "string" || type === "datetime") {
    return String(value);
  }
  if (type === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return ["true", "1", "yes"].includes(value.toLowerCase());
    }
  }
  return value;
}

async function recordSmokeRun(
  env: Record<string, unknown> | undefined,
  smoke: TrellisSmokeResult,
): Promise<TrellisSmokeHistory> {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
    };
  }

  await ensureD1Schema(db);
  const createdAt = new Date().toISOString();
  const status = smoke.ok ? "pass" : "fail";
  const id = `smoke_${normalizeIdPart(smoke.fixture.id)}_${normalizeIdPart(createdAt)}`;
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_smoke_runs
      (id, agent, status, fixture_id, trace_id, checks_json, result_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    smoke.agent,
    status,
    smoke.fixture.id,
    traceIdForSignal(smoke.fixture),
    JSON.stringify(smoke.checks),
    JSON.stringify({
      mode: smoke.mode,
      externalWrites: smoke.externalWrites,
      noSendsMode: smoke.noSendsMode,
      prospects: smoke.prospects.length,
      drafts: smoke.drafts.length,
      approvals: smoke.approvals.length,
      auditEvents: smoke.auditEvents.map((event) => event.type),
    }),
    createdAt,
  ]);
  await insertTraceEvent(env, db, {
    id: `trace_event_${id}`,
    traceId: traceIdForSignal(smoke.fixture),
    signalId: smoke.fixture.id,
    workflow: "smoke",
    span: "smoke:fixture",
    type: `smoke.${status}`,
    message: `Smoke fixture ${status === "pass" ? "passed" : "failed"}.`,
    payload: {
      smokeRunId: id,
      checks: smoke.checks.map((check) => ({
        id: check.id,
        status: check.status,
      })),
    },
  });

  return {
    enabled: true,
    table: "trellis_smoke_runs",
    id,
    status,
  };
}

async function ensureD1Schema(db: TrellisD1Database) {
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_signals (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      campaign_id TEXT,
      provider TEXT,
      source TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_prospects (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_state_records (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      record_id TEXT NOT NULL,
      signal_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      schema_json TEXT,
      indexes_json TEXT,
      relationships_json TEXT,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1Optional(db, `ALTER TABLE trellis_state_records ADD COLUMN schema_json TEXT`);
  await runD1Optional(db, `ALTER TABLE trellis_state_records ADD COLUMN indexes_json TEXT`);
  await runD1Optional(db, `ALTER TABLE trellis_state_records ADD COLUMN relationships_json TEXT`);
  await runD1(db, `
    CREATE INDEX IF NOT EXISTS idx_trellis_state_records_entity_record
      ON trellis_state_records (entity, record_id)
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_drafts (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      approval_required_json TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_audit_events (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      workflow TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_approvals (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL,
      signal_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_provider_actions (
      id TEXT PRIMARY KEY,
      approval_id TEXT NOT NULL,
      signal_id TEXT NOT NULL,
      draft_id TEXT,
      provider TEXT NOT NULL,
      operation TEXT NOT NULL,
      status TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_provider_runs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      external_id TEXT,
      status TEXT NOT NULL,
      request_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_workflow_runs (
      id TEXT PRIMARY KEY,
      signal_id TEXT NOT NULL,
      workflow TEXT NOT NULL,
      status TEXT NOT NULL,
      params_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_operator_controls (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      target_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      actor TEXT,
      updated_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_smoke_runs (
      id TEXT PRIMARY KEY,
      agent TEXT NOT NULL,
      status TEXT NOT NULL,
      fixture_id TEXT NOT NULL,
      trace_id TEXT NOT NULL,
      checks_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_trace_events (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      signal_id TEXT,
      workflow TEXT,
      span TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await runD1(db, `
    CREATE INDEX IF NOT EXISTS idx_trellis_trace_events_trace_created
      ON trellis_trace_events (trace_id, created_at)
  `);
  await runD1(db, `
    CREATE INDEX IF NOT EXISTS idx_trellis_trace_events_signal_created
      ON trellis_trace_events (signal_id, created_at)
  `);
  await runD1(db, `
    CREATE INDEX IF NOT EXISTS idx_trellis_trace_events_type_created
      ON trellis_trace_events (type, created_at)
  `);
  await runD1(db, `
    CREATE TABLE IF NOT EXISTS trellis_slack_threads (
      trace_id TEXT PRIMARY KEY,
      signal_id TEXT,
      trellis_thread_id TEXT,
      slack_channel_id TEXT NOT NULL,
      slack_thread_ts TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

async function runD1(db: TrellisD1Database, sql: string, bindings: unknown[] = []) {
  await db.prepare(sql).bind(...bindings).run();
}

async function runD1Optional(db: TrellisD1Database, sql: string, bindings: unknown[] = []) {
  try {
    await runD1(db, sql, bindings);
  } catch {
    // Optional D1 migrations are best-effort for existing generated apps.
  }
}

async function insertTraceEvent(
  env: Record<string, unknown> | undefined,
  db: TrellisD1Database,
  event: {
    id: string;
    traceId: string;
    signalId?: string;
    workflow?: string;
    span: string;
    type: string;
    message: string;
    payload?: Record<string, unknown>;
  },
) {
  const createdAt = nextTraceCreatedAt();
  const record: TrellisTraceEventRecord = {
    id: event.id,
    traceId: event.traceId,
    signalId: event.signalId ?? null,
    workflow: event.workflow ?? null,
    span: event.span,
    type: event.type,
    message: event.message,
    payload: redactTracePayload(event.payload ?? {}),
    createdAt,
  };

  await runD1(db, `
    INSERT OR REPLACE INTO trellis_trace_events
      (id, trace_id, signal_id, workflow, span, type, message, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    record.id,
    record.traceId,
    record.signalId,
    record.workflow,
    record.span,
    record.type,
    record.message,
    JSON.stringify(record.payload),
    record.createdAt,
  ]);

  await exportTraceEvent(env, record);
}

let lastTraceCreatedAtMs = 0;

function nextTraceCreatedAt() {
  const now = Date.now();
  const next = Math.max(now, lastTraceCreatedAtMs + 1);
  lastTraceCreatedAtMs = next;
  return new Date(next).toISOString();
}

async function exportTraceEvent(
  env: Record<string, unknown> | undefined,
  event: TrellisTraceEventRecord,
) {
  const tasks: Array<Promise<unknown>> = [];
  const exporter = env?.TRELLIS_TRACE_EXPORTER;

  if (isTraceExporterBinding(exporter)) {
    tasks.push(callTraceExporterBinding(exporter, event).catch(() => undefined));
  }

  const genericUrl = readString(env?.TRELLIS_TRACE_EXPORT_URL);
  if (genericUrl) {
    const headers: Record<string, string> = {};
    const token = readString(env?.TRELLIS_TRACE_EXPORT_TOKEN);
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    tasks.push(postTraceJson(env, genericUrl, {
      source: "trellis",
      event,
    }, headers).catch(() => undefined));
  }

  const langfusePublicKey = readString(env?.LANGFUSE_PUBLIC_KEY);
  const langfuseSecretKey = readString(env?.LANGFUSE_SECRET_KEY);
  if (langfusePublicKey && langfuseSecretKey) {
    const baseUrl = (readString(env?.LANGFUSE_BASE_URL) ?? "https://cloud.langfuse.com").replace(/\/+$/, "");
    tasks.push(postTraceJson(env, `${baseUrl}/api/public/ingestion`, {
      batch: [
        {
          id: event.id,
          timestamp: event.createdAt,
          type: "event-create",
          body: {
            id: event.id,
            traceId: event.traceId,
            name: event.type,
            startTime: event.createdAt,
            metadata: traceEventMetadata(event),
          },
        },
      ],
    }, {
      authorization: `Basic ${base64Encode(`${langfusePublicKey}:${langfuseSecretKey}`)}`,
    }).catch(() => undefined));
  }

  const braintrustApiKey = readString(env?.BRAINTRUST_API_KEY);
  const braintrustProjectId = readString(env?.BRAINTRUST_PROJECT_ID);
  if (braintrustApiKey && braintrustProjectId) {
    const baseUrl = (readString(env?.BRAINTRUST_BASE_URL) ?? "https://api.braintrust.dev").replace(/\/+$/, "");
    tasks.push(postTraceJson(env, `${baseUrl}/v1/project_logs/${encodeURIComponent(braintrustProjectId)}/insert`, {
      events: [
        {
          id: event.id,
          span_id: event.id,
          root_span_id: event.traceId,
          created: event.createdAt,
          span_attributes: {
            name: event.type,
            type: event.span,
          },
          metadata: traceEventMetadata(event),
        },
      ],
    }, {
      authorization: `Bearer ${braintrustApiKey}`,
    }).catch(() => undefined));
  }

  await Promise.all(tasks);
}

type TrellisTraceExporterBinding =
  | ((event: TrellisTraceEventRecord) => Promise<unknown> | unknown)
  | {
      export?: (event: TrellisTraceEventRecord) => Promise<unknown> | unknown;
      send?: (event: TrellisTraceEventRecord) => Promise<unknown> | unknown;
    };

function isTraceExporterBinding(value: unknown): value is TrellisTraceExporterBinding {
  return typeof value === "function"
    || (isRecord(value) && (typeof value.export === "function" || typeof value.send === "function"));
}

async function callTraceExporterBinding(
  exporter: TrellisTraceExporterBinding,
  event: TrellisTraceEventRecord,
) {
  if (typeof exporter === "function") {
    return await exporter(event);
  }
  if (typeof exporter.export === "function") {
    return await exporter.export(event);
  }
  return await exporter.send?.(event);
}

async function postTraceJson(
  env: Record<string, unknown> | undefined,
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const response = await runtimeFetch(env, url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Trace export failed with ${response.status}.`);
  }
}

function traceEventMetadata(event: TrellisTraceEventRecord) {
  return {
    ...event.payload,
    trellisTraceEventId: event.id,
    traceId: event.traceId,
    signalId: event.signalId,
    workflow: event.workflow,
    span: event.span,
    type: event.type,
    message: event.message,
  };
}

function base64Encode(value: string) {
  if (typeof btoa === "function") {
    return btoa(value);
  }
  return Buffer.from(value, "utf8").toString("base64");
}

async function enqueueRuntimeEvent(env: Record<string, unknown> | undefined, run: TrellisRuntimeResult) {
  const queue = env?.TRELLIS_EVENTS as TrellisQueue | undefined;
  if (!queue?.send) {
    return {
      enabled: false,
    };
  }

  await queue.send({
    type: "trellis.signal.processed",
    traceId: traceIdForSignal(run.signal),
    signalId: run.signal.id,
    workspaceId: run.signal.workspaceId,
    threadId: run.signal.threadId,
    prospectIds: run.prospects.map((prospect) => prospect.id),
    draftIds: run.drafts.map((draft) => draft.id),
    approvalIds: run.approvals.map((approval) => approval.id),
    auditEventIds: run.auditEvents.map((event) => event.id),
  });
  return {
    enabled: true,
    messages: 1,
  };
}

function readWorkflowEventParams(event: unknown): Record<string, unknown> {
  if (!isRecord(event)) {
    return {};
  }
  if (isRecord(event.params)) {
    return event.params;
  }
  if (isRecord(event.payload)) {
    return event.payload;
  }
  return event;
}

async function runFollowUpWorkflow(
  env: Record<string, unknown> | undefined,
  input: {
    params: Record<string, unknown>;
    runId: string;
    signal: TrellisSignal;
    step: unknown;
    traceId: string;
  },
) {
  const followUp = isRecord(input.params.followUp) ? input.params.followUp : {};
  const delay = readString(input.params.followUpDelay)
    ?? readString(followUp.delay)
    ?? defaultFollowUpDelay(env);
  const checkpoint = await runWorkflowStep(input.step, "plan follow-up check", () => ({
    signalId: input.signal.id,
    traceId: input.traceId,
    workflow: "follow_up",
    providerActionId: readString(input.params.providerActionId),
    draftId: readString(input.params.draftId),
    delay,
    next: readString(followUp.next) ?? "draft_follow_up_if_no_reply",
  }));
  const scheduled = await runWorkflowStep(input.step, "record follow-up schedule", () =>
    recordWorkflowRun(env, {
      id: input.runId,
      traceId: input.traceId,
      signalId: input.signal.id,
      workflow: "follow_up",
      status: "follow_up_scheduled",
      params: {
        ...input.params,
        checkpoint,
      },
    }),
  );
  const sleep = await runWorkflowSleep(input.step, "wait for follow-up window", delay);
  const sequence = isRecord(followUp.sequence) ? followUp.sequence : {};
  const stopOn = readStringArray(sequence.stopOn);
  const stopped = stopOn.length > 0
    ? await readSequenceStopState(env, input.signal, stopOn)
    : { stopped: false, reason: null };
  if (stopped.stopped) {
    const stoppedRecord = await runWorkflowStep(input.step, "record follow-up stopped", () =>
      recordWorkflowRun(env, {
        id: input.runId,
        traceId: input.traceId,
        signalId: input.signal.id,
        workflow: "follow_up",
        status: "follow_up_stopped",
        params: {
          ...input.params,
          checkpoint: {
            ...checkpoint,
            stopped,
          },
        },
      }),
    );

    return {
      ok: true,
      workflow: "follow_up",
      runId: input.runId,
      traceId: input.traceId,
      signalId: input.signal.id,
      status: "follow_up_stopped",
      reason: readString(stopped.reason) ?? "sequence_stop_condition",
      checkpoint,
      stopped,
      sleep,
      persistence: {
        scheduled,
        stopped: stoppedRecord,
      },
    };
  }
  const due = await runWorkflowStep(input.step, "record follow-up due", () =>
    recordWorkflowRun(env, {
      id: input.runId,
      traceId: input.traceId,
      signalId: input.signal.id,
      workflow: "follow_up",
      status: "follow_up_due",
      params: {
        ...input.params,
        checkpoint: {
          ...checkpoint,
          next: "draft_follow_up_if_no_reply",
        },
      },
    }),
  );

  return {
    ok: true,
    workflow: "follow_up",
    runId: input.runId,
    traceId: input.traceId,
    signalId: input.signal.id,
    status: "follow_up_due",
    checkpoint,
    sleep,
    persistence: {
      scheduled,
      due,
    },
  };
}

function defaultFollowUpDelay(env: Record<string, unknown> | undefined) {
  return readString(env?.TRELLIS_FOLLOW_UP_DELAY)
    ?? readString(env?.FOLLOW_UP_DELAY)
    ?? "3 days";
}

function readAgentMailSequence(provider: TrellisProviderDefinition | undefined): TrellisAgentMailSequenceMap | null {
  const sequence = provider?.config?.sequence;
  if (!isRecord(sequence) || !Array.isArray(sequence.steps)) {
    return null;
  }
  const steps: TrellisAgentMailSequenceStep[] = [];
  for (const rawStep of sequence.steps) {
    if (!isRecord(rawStep)) {
      continue;
    }
    const id = readString(rawStep.id);
    const operation = readAgentMailSequenceOperation(rawStep.operation);
    if (!id || !operation) {
      continue;
    }
    steps.push({
      id,
      operation,
      draftSkill: readString(rawStep.draftSkill),
      delay: readString(rawStep.delay),
      condition: readString(rawStep.condition),
      approval: readAgentMailSequenceApproval(rawStep.approval),
      subject: readString(rawStep.subject),
      bodyText: readString(rawStep.bodyText),
    });
  }

  if (steps.length === 0) {
    return null;
  }

  return {
    provider: readString(sequence.provider) === "agentmail" ? "agentmail" : "mail",
    defaultInboxId: readString(sequence.defaultInboxId),
    stopOn: readStringArray(sequence.stopOn),
    steps,
  };
}

function readAgentMailSequenceOperation(value: unknown): TrellisAgentMailSequenceOperation | undefined {
  const operation = readString(value);
  if (operation === "email.send" || operation === "email.reply" || operation === "mail.send" || operation === "mail.reply") {
    return operation;
  }
  return undefined;
}

function readAgentMailSequenceApproval(value: unknown): TrellisAgentMailSequenceApproval | undefined {
  const approval = readString(value);
  if (approval === "required" || approval === "optional" || approval === "none") {
    return approval;
  }
  return undefined;
}

async function resolveAgentMailSequencePlan(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
  config: TrellisAgentConfig,
) {
  if (!["agentmail", "mail"].includes(context.action.provider) || !isMailOutboundOperation(context.action.operation)) {
    return {
      enabled: false as const,
      reason: "not_mail_outbound",
    };
  }

  const sequence = readAgentMailSequence(resolveMailProvider(config));
  if (!sequence) {
    if (context.action.operation !== "email.send" && context.action.operation !== "mail.send") {
      return {
        enabled: false as const,
        reason: "not_initial_outbound_email",
      };
    }
    const defaultCurrentStep: TrellisAgentMailSequenceStep = {
      id: "initial",
      operation: context.action.operation === "mail.send" ? "mail.send" : "email.send",
    };
    const defaultNextStep: TrellisAgentMailSequenceStep = {
      id: "draft_follow_up_if_no_reply",
      operation: context.action.operation === "mail.send" ? "mail.reply" : "email.reply",
      delay: defaultFollowUpDelay(env),
      condition: "no_reply",
      approval: "required",
    };
    return {
      enabled: true as const,
      sequence: null,
      currentStep: defaultCurrentStep,
      nextStep: defaultNextStep,
      stopOn: ["reply.received", "unsubscribe", "bounce", "manual.pause", "kill_switch"],
    };
  }

  const stopOn = sequence.stopOn?.length
    ? sequence.stopOn
    : ["reply.received", "unsubscribe", "bounce", "manual.pause", "kill_switch"];
  const stopped = await readSequenceStopState(env, context.signal, stopOn);
  if (stopped.stopped) {
    return {
      enabled: false as const,
      reason: stopped.reason,
      stopped,
    };
  }

  const currentStepId = readFirstString(context.input, context.signal?.payload ?? {}, [
    "sequenceStepId",
    "sequenceStep",
    "stepId",
  ]);
  const currentStepIndex = Math.max(0, sequence.steps.findIndex((step) =>
    currentStepId ? step.id === currentStepId : step.operation === context.action.operation
  ));
  const currentStep = sequence.steps[currentStepIndex];
  const nextStep = sequence.steps[currentStepIndex + 1];
  if (!currentStep || !nextStep) {
    return {
      enabled: false as const,
      reason: "sequence_complete",
      sequence,
      currentStep,
    };
  }

  return {
    enabled: true as const,
    sequence,
    currentStep,
    nextStep,
    stopOn,
  };
}

function isMailOutboundOperation(operation: string) {
  return operation === "email.send" || operation === "email.reply" || operation === "mail.send" || operation === "mail.reply";
}

function addDurationToIso(start: Date, duration: string | number) {
  const milliseconds = durationToMilliseconds(duration);
  if (!milliseconds) {
    return null;
  }
  return new Date(start.getTime() + milliseconds).toISOString();
}

function durationToMilliseconds(duration: string | number) {
  if (typeof duration === "number" && Number.isFinite(duration)) {
    return duration;
  }
  const value = readString(duration)?.trim().toLowerCase();
  if (!value) {
    return null;
  }
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(ms|millisecond|milliseconds|s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)$/);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit.startsWith("ms")
    ? 1
    : unit === "s" || unit.startsWith("sec")
      ? 1_000
      : unit === "m" || unit.startsWith("min")
        ? 60_000
        : unit === "h" || unit === "hr" || unit.startsWith("hour")
          ? 3_600_000
          : 86_400_000;
  return amount * multiplier;
}

async function readSequenceStopState(
  env: Record<string, unknown> | undefined,
  signal: TrellisSignalRecord | TrellisSignal | null,
  stopOn: string[],
) {
  if (!signal) {
    return {
      stopped: false,
      reason: null,
    };
  }

  if (stopOn.includes("manual.pause") || stopOn.includes("kill_switch")) {
    const controls = await readOperatorControls(env, signal);
    if (controls.blocked) {
      return {
        stopped: true,
        reason: controls.reasons.join("; "),
        controls,
      };
    }
  }

  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare || !signal.threadId) {
    return {
      stopped: false,
      reason: null,
    };
  }

  await ensureD1Schema(db);
  const rows = await readD1Rows<{
    id: string;
    provider?: string | null;
    source?: string | null;
    payloadJson?: string | null;
    createdAt?: string | null;
  }>(db, `
    SELECT
      id,
      provider,
      source,
      payload_json AS payloadJson,
      created_at AS createdAt
    FROM trellis_signals
    WHERE thread_id = ?
    ORDER BY created_at DESC
    LIMIT 25
  `, [signal.threadId]);

  for (const row of rows) {
    if (row.id === signal.id) {
      continue;
    }
    const payload = parseRecordJson(row.payloadJson);
    const source = readString(row.source) ?? readString(payload.source) ?? "";
    const provider = readString(row.provider) ?? readString(payload.provider) ?? "";
    const eventType = `${readString(payload.eventType) ?? ""} ${readString(payload.type) ?? ""}`.toLowerCase();
    const bodyText = `${readString(payload.bodyText) ?? ""} ${readString(payload.text) ?? ""}`.toLowerCase();
    const isReply = source === "reply.webhook" || provider === "agentmail" || eventType.includes("reply") || eventType.includes("inbound");
    const isUnsubscribe = eventType.includes("unsubscribe") || bodyText.includes("unsubscribe");
    const isBounce = eventType.includes("bounce") || eventType.includes("failed_delivery");

    if (stopOn.includes("unsubscribe") && isUnsubscribe) {
      return {
        stopped: true,
        reason: "unsubscribe",
        signalId: row.id,
      };
    }
    if (stopOn.includes("bounce") && isBounce) {
      return {
        stopped: true,
        reason: "bounce",
        signalId: row.id,
      };
    }
    if (stopOn.includes("reply.received") && isReply) {
      return {
        stopped: true,
        reason: "reply.received",
        signalId: row.id,
      };
    }
  }

  return {
    stopped: false,
    reason: null,
  };
}

async function sweepTrellisSchedules(
  env: Record<string, unknown> | undefined,
  _config: TrellisAgentConfig,
  controller: unknown,
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      ok: true,
      enabled: false,
      reason: "d1_unavailable",
    };
  }

  await ensureD1Schema(db);
  const scheduledTime = isRecord(controller)
    ? readNumber(controller.scheduledTime) ?? Date.now()
    : Date.now();
  const nowIso = new Date(scheduledTime).toISOString();
  const rows = await readD1Rows<TrellisWorkflowRunRow>(db, `
    SELECT
      id,
      signal_id AS signalId,
      workflow,
      status,
      params_json AS paramsJson,
      updated_at AS updatedAt
    FROM trellis_workflow_runs
    WHERE workflow = ?
      AND status IN (?, ?)
    ORDER BY updated_at ASC
    LIMIT 100
  `, ["follow_up", "scheduled", "follow_up_scheduled"]);

  let due = 0;
  let stopped = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.workflow !== "follow_up" || (row.status !== "scheduled" && row.status !== "follow_up_scheduled")) {
      skipped += 1;
      continue;
    }
    const params = parseRecordJson(row.paramsJson);
    const followUp = isRecord(params.followUp) ? params.followUp : {};
    const dueAt = readString(followUp.dueAt);
    if (!dueAt || dueAt > nowIso) {
      skipped += 1;
      continue;
    }

    const signal = readWorkflowSignal(isRecord(params.signal) ? params.signal : { id: row.signalId });
    const sequence = isRecord(followUp.sequence) ? followUp.sequence : {};
    const stopOn = readStringArray(sequence.stopOn);
    const stopState = stopOn.length > 0
      ? await readSequenceStopState(env, signal, stopOn)
      : { stopped: false, reason: null };
    const nextStatus = stopState.stopped ? "follow_up_stopped" : "follow_up_due";
    await recordWorkflowRun(env, {
      id: row.id,
      traceId: readString(params.traceId) ?? traceIdForSignal(signal),
      signalId: row.signalId,
      workflow: "follow_up",
      status: nextStatus,
      params: {
        ...params,
        sweptAt: nowIso,
        sweep: {
          cron: isRecord(controller) ? readString(controller.cron) ?? null : null,
          stopState,
        },
      },
    });

    if (stopState.stopped) {
      stopped += 1;
    } else {
      due += 1;
    }
  }

  return {
    ok: true,
    enabled: true,
    checked: rows.length,
    due,
    stopped,
    skipped,
    scheduledTime: nowIso,
  };
}

function readWorkflowSignal(value: unknown): TrellisSignal {
  const record = isRecord(value) ? value : {};
  const id = readString(record.id) ?? readString(record.signalId) ?? "sig_workflow";
  return {
    id,
    traceId: readString(record.traceId) ?? readString(record.trace_id) ?? `trace_${normalizeIdPart(id)}`,
    threadId: readString(record.threadId) ?? `thr_${id}`,
    workspaceId: readString(record.workspaceId) ?? "wrk_default",
    campaignId: readString(record.campaignId),
    idempotencyKey: readString(record.idempotencyKey),
    provider: readString(record.provider) ?? "workflow",
    source: readString(record.source) ?? "cloudflare.workflow",
    payload: isRecord(record.payload) ? record.payload : record,
  };
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter((item): item is string => Boolean(item)) : [];
}

async function runWorkflowStep<T>(
  step: unknown,
  name: string,
  callback: () => Promise<T> | T,
): Promise<T> {
  if (isWorkflowStep(step)) {
    return await step.do(name, callback);
  }
  return await callback();
}

async function runWorkflowSleep(
  step: unknown,
  name: string,
  duration: string | number,
) {
  if (isWorkflowStep(step) && typeof step.sleep === "function") {
    await step.sleep(name, duration);
    return {
      enabled: true,
      duration,
    };
  }
  return {
    enabled: false,
    duration,
  };
}

function isWorkflowStep(value: unknown): value is TrellisWorkflowStep {
  return isRecord(value) && typeof value.do === "function";
}

async function recordWorkflowRun(
  env: Record<string, unknown> | undefined,
  record: {
    id: string;
    traceId?: string;
    signalId: string;
    workflow: string;
    status: string;
    params: Record<string, unknown>;
  },
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
    };
  }

  await ensureD1Schema(db);
  const now = new Date().toISOString();
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_workflow_runs
      (id, signal_id, workflow, status, params_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    record.id,
    record.signalId,
    record.workflow,
    record.status,
    JSON.stringify(record.params),
    now,
  ]);
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_audit_events
      (id, signal_id, workflow, type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    `evt_${normalizeIdPart(record.id)}_${normalizeIdPart(record.status)}`,
    record.signalId,
    record.workflow,
    `workflow.${record.status}`,
    `Workflow ${record.workflow} is ${record.status}.`,
    now,
  ]);
  await insertTraceEvent(env, db, {
    id: `trace_event_${normalizeIdPart(record.id)}_${normalizeIdPart(record.status)}`,
    traceId: record.traceId ?? traceIdForSignalId(record.signalId),
    signalId: record.signalId,
    workflow: record.workflow,
    span: `workflow:${record.workflow}`,
    type: `workflow.${record.status}`,
    message: `Workflow ${record.workflow} is ${record.status}.`,
    payload: {
      workflowRunId: record.id,
      status: record.status,
    },
  });

  return {
    enabled: true,
    table: "trellis_workflow_runs",
    id: record.id,
    status: record.status,
  };
}

async function recordOperatorControl(
  env: Record<string, unknown> | undefined,
  change: TrellisOperatorControlChange,
) {
  const control: TrellisOperatorControlRecord = {
    id: operatorControlId(change.scope, change.targetId),
    scope: change.scope,
    targetId: change.targetId,
    status: change.status,
    reason: change.reason ?? null,
    actor: change.actor ?? null,
    updatedAt: new Date().toISOString(),
  };
  return {
    control,
    persistence: await persistOperatorControl(env, control, change.traceId),
    queue: await enqueueOperatorControl(env, control, change.traceId),
  };
}

async function persistOperatorControl(
  env: Record<string, unknown> | undefined,
  control: TrellisOperatorControlRecord,
  traceId?: string,
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      tables: [],
    };
  }

  await ensureD1Schema(db);
  const now = control.updatedAt ?? new Date().toISOString();
  const signalId = `operator:${control.id}`;
  const resolvedTraceId = traceId ?? `trace_operator_${normalizeIdPart(control.id)}`;
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_operator_controls
      (id, scope, target_id, status, reason, actor, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    control.id,
    control.scope,
    control.targetId,
    control.status,
    control.reason ?? null,
    control.actor ?? null,
    now,
  ]);
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_audit_events
      (id, signal_id, workflow, type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    `evt_operator_${normalizeIdPart(control.id)}_${normalizeIdPart(control.status)}`,
    signalId,
    "operator-control",
    `operator_control.${control.status}`,
    operatorControlMessage(control),
    now,
  ]);
  await insertTraceEvent(env, db, {
    id: `trace_event_operator_${normalizeIdPart(control.id)}_${normalizeIdPart(control.status)}`,
    traceId: resolvedTraceId,
    signalId,
    workflow: "operator-control",
    span: `operator:${control.scope}`,
    type: `operator_control.${control.status}`,
    message: operatorControlMessage(control),
    payload: {
      id: control.id,
      scope: control.scope,
      targetId: control.targetId,
      status: control.status,
      reason: control.reason ?? null,
      actor: control.actor ?? null,
    },
  });

  return {
    enabled: true,
    tables: ["trellis_operator_controls", "trellis_audit_events", "trellis_trace_events"],
  };
}

async function enqueueOperatorControl(
  env: Record<string, unknown> | undefined,
  control: TrellisOperatorControlRecord,
  traceId?: string,
) {
  const queue = env?.TRELLIS_EVENTS as TrellisQueue | undefined;
  if (!queue?.send) {
    return {
      enabled: false,
    };
  }

  await queue.send({
    type: "trellis.operator.control.changed",
    traceId: traceId ?? `trace_operator_${normalizeIdPart(control.id)}`,
    control,
  });
  return {
    enabled: true,
    messages: 1,
  };
}

function operatorControlMessage(control: TrellisOperatorControlRecord) {
  if (control.scope === "global") {
    return `${control.status === "enabled" ? "Enabled" : "Disabled"} Trellis global kill switch.`;
  }
  return `${control.status === "paused" ? "Paused" : "Resumed"} ${control.scope} ${control.targetId}.`;
}

async function readOperatorControls(
  env: Record<string, unknown> | undefined,
  signal?: Pick<TrellisSignal, "id" | "threadId" | "campaignId"> | TrellisSignalRecord | null,
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      globalKillSwitch: null,
      campaign: null,
      thread: null,
      blocked: false,
      reasons: [],
    };
  }

  await ensureD1Schema(db);
  const globalKillSwitch = await readOperatorControl(db, operatorControlId("global", "kill_switch"));
  const campaign = signal?.campaignId
    ? await readOperatorControl(db, operatorControlId("campaign", signal.campaignId))
    : null;
  const thread = signal?.threadId
    ? await readOperatorControl(db, operatorControlId("thread", signal.threadId))
    : null;
  const reasons = [
    globalKillSwitch?.status === "enabled" ? (globalKillSwitch.reason ?? "global kill switch enabled") : null,
    campaign?.status === "paused" ? (campaign.reason ?? "campaign is paused") : null,
    thread?.status === "paused" ? (thread.reason ?? "thread is paused") : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    enabled: true,
    globalKillSwitch,
    campaign,
    thread,
    blocked: reasons.length > 0,
    reasons,
  };
}

async function readOperatorControl(db: TrellisD1Database, id: string) {
  return await db.prepare(`
    SELECT
      id,
      scope,
      target_id AS targetId,
      status,
      reason,
      actor,
      updated_at AS updatedAt
    FROM trellis_operator_controls
    WHERE id = ?
  `).bind(id).first<TrellisOperatorControlRecord>();
}

function operatorControlId(scope: TrellisOperatorControlScope, targetId: string) {
  return `${scope}:${targetId}`;
}

async function dispatchWorkflow(env: Record<string, unknown> | undefined, run: TrellisRuntimeResult) {
  const workflow = env?.PROSPECT_WORKFLOW as TrellisWorkflowBinding | undefined;
  if (!workflow?.create) {
    return {
      enabled: false,
    };
  }

  const workflowName = run.startedWorkflows[0]?.name ?? "prospect";
  const id = `trellis_${normalizeIdPart(run.signal.id)}_${normalizeIdPart(workflowName)}`;
  const controls = await readOperatorControls(env, run.signal);
  if (controls.blocked) {
    const persistence = await recordWorkflowRun(env, {
      id,
      traceId: traceIdForSignal(run.signal),
      signalId: run.signal.id,
      workflow: workflowName,
      status: "paused",
      params: {
        traceId: traceIdForSignal(run.signal),
        signal: run.signal,
        workflow: workflowName,
        controls,
        reason: controls.reasons.join("; "),
      },
    });
    return {
      enabled: true,
      ok: true,
      blocked: true,
      workflow: workflowName,
      instanceId: id,
      status: "paused",
      reason: controls.reasons.join("; "),
      controls,
      persistence,
    };
  }
  try {
    const instance = await workflow.create({
      id,
      params: {
        ...workflowInputParams(run),
        traceId: traceIdForSignal(run.signal),
        signal: run.signal,
        workflow: workflowName,
        startedWorkflows: run.startedWorkflows,
        prospectIds: run.prospects.map((prospect) => prospect.id),
        draftIds: run.drafts.map((draft) => draft.id),
        approvalIds: run.approvals.map((approval) => approval.id),
        auditEventIds: run.auditEvents.map((event) => event.id),
      },
    });
    const record = isRecord(instance) ? instance : {};
    const persistence = await recordWorkflowRun(env, {
      id,
      traceId: traceIdForSignal(run.signal),
      signalId: run.signal.id,
      workflow: workflowName,
      status: "dispatched",
      params: {
        ...workflowInputParams(run),
        traceId: traceIdForSignal(run.signal),
        signal: run.signal,
        workflow: workflowName,
        startedWorkflows: run.startedWorkflows,
        prospectIds: run.prospects.map((prospect) => prospect.id),
        draftIds: run.drafts.map((draft) => draft.id),
        approvalIds: run.approvals.map((approval) => approval.id),
        auditEventIds: run.auditEvents.map((event) => event.id),
      },
    });
    return {
      enabled: true,
      ok: true,
      workflow: workflowName,
      instanceId: readString(record.id) ?? id,
      persistence,
    };
  } catch (error) {
    const persistence = await recordWorkflowRun(env, {
      id,
      traceId: traceIdForSignal(run.signal),
      signalId: run.signal.id,
      workflow: workflowName,
      status: "dispatch_failed",
      params: {
        traceId: traceIdForSignal(run.signal),
        signal: run.signal,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      enabled: true,
      ok: false,
      workflow: workflowName,
      instanceId: id,
      error: error instanceof Error ? error.message : String(error),
      persistence,
    };
  }
}

function workflowInputParams(run: TrellisRuntimeResult) {
  const input = run.startedWorkflows[0]?.input;
  return isRecord(input) ? input : {};
}

async function scheduleFollowUpWorkflow(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
  result: TrellisProviderActionExecutionResult,
  config: TrellisAgentConfig,
) {
  const sequencePlan = await resolveAgentMailSequencePlan(env, context, config);
  if (!sequencePlan.enabled) {
    return {
      enabled: false,
      reason: sequencePlan.reason,
    };
  }

  const workflow = env?.PROSPECT_WORKFLOW as TrellisWorkflowBinding | undefined;
  if (!workflow?.create) {
    return {
      enabled: false,
    };
  }

  const signal = context.signal;
  if (!signal) {
    return {
      enabled: true,
      ok: false,
      error: "signal_unavailable",
      detail: "Trellis could not schedule a follow-up because the original signal was not found.",
    };
  }

  const trellisSignal: TrellisSignal = {
    id: signal.id,
    traceId: context.action.traceId,
    workspaceId: signal.workspaceId,
    threadId: signal.threadId,
    campaignId: readString(signal.campaignId),
    provider: "trellis",
    source: "provider-action.completed",
    payload: signal.payload,
  };
  const id = `trellis_${normalizeIdPart(context.action.signalId)}_follow_up_${normalizeIdPart(context.action.id)}`;
  const delay = readString(context.input.followUpDelay)
    ?? readString(context.input.follow_up_delay)
    ?? sequencePlan.nextStep.delay
    ?? defaultFollowUpDelay(env);
  const dueAt = addDurationToIso(new Date(), delay);
  const params = {
    workflowRunId: id,
    traceId: context.action.traceId,
    signal: trellisSignal,
    workflow: "follow_up",
    providerActionId: context.action.id,
    draftId: context.action.draftId ?? null,
    followUp: {
      delay,
      dueAt,
      next: sequencePlan.nextStep.id,
      condition: sequencePlan.nextStep.condition ?? "no_reply",
      operation: sequencePlan.nextStep.operation,
      draftSkill: sequencePlan.nextStep.draftSkill ?? null,
      approval: sequencePlan.nextStep.approval ?? "required",
      sequence: {
        provider: "agentmail",
        currentStepId: sequencePlan.currentStep.id,
        nextStepId: sequencePlan.nextStep.id,
        stopOn: sequencePlan.stopOn,
      },
    },
    execution: {
      externalId: result.externalId ?? null,
      externalThreadId: result.externalThreadId ?? null,
    },
  };
  const controls = await readOperatorControls(env, trellisSignal);
  if (controls.blocked) {
    const persistence = await recordWorkflowRun(env, {
      id,
      traceId: context.action.traceId,
      signalId: context.action.signalId,
      workflow: "follow_up",
      status: "paused",
      params: {
        ...params,
        controls,
        reason: controls.reasons.join("; "),
      },
    });
    return {
      enabled: true,
      ok: true,
      blocked: true,
      workflow: "follow_up",
      instanceId: id,
      status: "paused",
      reason: controls.reasons.join("; "),
      controls,
      persistence,
    };
  }

  try {
    const instance = await workflow.create({
      id,
      params,
    });
    const record = isRecord(instance) ? instance : {};
    const persistence = await recordWorkflowRun(env, {
      id,
      traceId: context.action.traceId,
      signalId: context.action.signalId,
      workflow: "follow_up",
      status: "scheduled",
      params,
    });
    return {
      enabled: true,
      ok: true,
      workflow: "follow_up",
      instanceId: readString(record.id) ?? id,
      delay,
      dueAt,
      next: sequencePlan.nextStep.id,
      sequence: {
        currentStepId: sequencePlan.currentStep.id,
        nextStepId: sequencePlan.nextStep.id,
        stopOn: sequencePlan.stopOn,
      },
      persistence,
    };
  } catch (error) {
    const persistence = await recordWorkflowRun(env, {
      id,
      traceId: context.action.traceId,
      signalId: context.action.signalId,
      workflow: "follow_up",
      status: "schedule_failed",
      params: {
        ...params,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return {
      enabled: true,
      ok: false,
      workflow: "follow_up",
      instanceId: id,
      error: error instanceof Error ? error.message : String(error),
      persistence,
    };
  }
}

async function replayWorkflowRun(
  env: Record<string, unknown> | undefined,
  input: {
    workflowRunId: string;
    replayId?: string;
    actor?: string;
    reason?: string;
  },
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      status: 501,
      body: {
        ok: false,
        error: "workflow_state_unavailable",
        detail: "TRELLIS_DB is required before workflow runs can be replayed.",
      },
    };
  }

  const workflow = env?.PROSPECT_WORKFLOW as TrellisWorkflowBinding | undefined;
  if (!workflow?.create) {
    return {
      status: 501,
      body: {
        ok: false,
        error: "workflow_binding_unavailable",
        detail: "PROSPECT_WORKFLOW is required before workflow runs can be replayed.",
      },
    };
  }

  await ensureD1Schema(db);
  const stored = await readWorkflowRunRecord(db, input.workflowRunId);
  if (!stored) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "workflow_run_not_found",
        workflowRunId: input.workflowRunId,
      },
    };
  }

  const params: Record<string, unknown> = parseRecordJson(stored.paramsJson);
  const replayId = input.replayId ?? `${stored.id}_replay_${Date.now()}`;
  const replayParams: Record<string, unknown> = {
    ...params,
    replayOf: stored.id,
    replayActor: input.actor ?? null,
    replayReason: input.reason ?? null,
  };
  const instance = await workflow.create({
    id: replayId,
    params: replayParams,
  });
  const record = isRecord(instance) ? instance : {};
  const traceId = readString(replayParams.traceId) ?? traceIdForSignalId(stored.signalId);
  const persistence = await recordWorkflowRun(env, {
    id: replayId,
    traceId,
    signalId: stored.signalId,
    workflow: stored.workflow,
    status: "replayed",
    params: replayParams,
  });
  return {
    status: 200,
    body: {
      ok: true,
      workflowRunId: stored.id,
      replayId: readString(record.id) ?? replayId,
      workflow: stored.workflow,
      persistence,
    },
  };
}

async function readWorkflowRunRecord(db: TrellisD1Database, workflowRunId: string) {
  return await db.prepare(`
    SELECT
      id,
      signal_id AS signalId,
      workflow,
      status,
      params_json AS paramsJson,
      updated_at AS updatedAt
    FROM trellis_workflow_runs
    WHERE id = ?
  `).bind(workflowRunId).first<TrellisWorkflowRunRow>();
}

async function recordApprovalDecision(
  env: Record<string, unknown> | undefined,
  decision: TrellisApprovalDecision,
  config: TrellisAgentConfig,
) {
  const providerAction = decision.status === "approved"
    ? createProviderActionIntent(decision, config)
    : null;
  return {
    persistence: await persistApprovalDecision(env, decision, providerAction),
    queue: await enqueueApprovalDecision(env, decision, providerAction),
    providerAction,
  };
}

function createProviderActionIntent(
  decision: TrellisApprovalDecision,
  config: TrellisAgentConfig,
): TrellisProviderAction {
  const provider = providerForOperation(config, decision.action);
  const status = config.safety?.noSends === false ? "queued" : "blocked_no_send";
  return {
    id: `provider_action_${decision.approvalId}`,
    approvalId: decision.approvalId,
    signalId: decision.signalId,
    draftId: decision.draftId,
    provider,
    operation: decision.action,
    status,
    traceId: decision.traceId ?? traceIdForSignalId(decision.signalId),
  };
}

function providerForOperation(config: TrellisAgentConfig, operation: string) {
  if (operation.startsWith("email.") || operation.startsWith("mail.")) {
    return resolveMailProvider(config)?.id ?? "mail";
  }
  if (operation.startsWith("crm.")) {
    return config.crm?.id ?? "crm";
  }
  if (operation.startsWith("research.")) {
    return resolveResearchProvider(config)?.id ?? "research";
  }
  if (operation.startsWith("browser.")) {
    return resolveBrowserProvider(config)?.id ?? "browser";
  }
  if (operation.startsWith("handoff.")) {
    return config.handoff?.id ?? "handoff";
  }
  return "provider";
}

function resolveMailProvider(config: TrellisAgentConfig) {
  return config.mail ?? config.email;
}

function resolveResearchProvider(config: TrellisAgentConfig) {
  return config.research;
}

function resolveBrowserProvider(config: TrellisAgentConfig) {
  return config.browser;
}

async function persistApprovalDecision(
  env: Record<string, unknown> | undefined,
  decision: TrellisApprovalDecision,
  providerAction: TrellisProviderAction | null,
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      tables: [],
    };
  }

  const now = new Date().toISOString();
  await ensureD1Schema(db);
  await runD1(db, `
    UPDATE trellis_approvals
    SET status = ?, updated_at = ?
    WHERE id = ?
  `, [
    decision.status,
    now,
    decision.approvalId,
  ]);
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_audit_events
      (id, signal_id, workflow, type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    `evt_${decision.status}_${decision.approvalId}`,
    decision.signalId,
    "approval",
    `approval.${decision.status}`,
    `${decision.status === "approved" ? "Approved" : "Rejected"} approval ${decision.approvalId}.`,
    now,
  ]);
  await insertTraceEvent(env, db, {
    id: `trace_event_${decision.status}_${decision.approvalId}`,
    traceId: decision.traceId ?? traceIdForSignalId(decision.signalId),
    signalId: decision.signalId,
    workflow: "approval",
    span: "approval",
    type: `approval.${decision.status}`,
    message: `${decision.status === "approved" ? "Approved" : "Rejected"} approval ${decision.approvalId}.`,
    payload: {
      approvalId: decision.approvalId,
      action: decision.action,
      actor: decision.actor ?? null,
      reason: decision.reason ?? null,
    },
  });

  if (providerAction) {
    await runD1(db, `
      INSERT OR REPLACE INTO trellis_provider_actions
        (id, approval_id, signal_id, draft_id, provider, operation, status, trace_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      providerAction.id,
      providerAction.approvalId,
      providerAction.signalId,
      providerAction.draftId ?? null,
      providerAction.provider,
      providerAction.operation,
      providerAction.status,
      providerAction.traceId,
      now,
      now,
    ]);
    await runD1(db, `
      INSERT OR REPLACE INTO trellis_audit_events
        (id, signal_id, workflow, type, message, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      `evt_${providerAction.status}_${providerAction.id}`,
      providerAction.signalId,
      "provider-action",
      `provider_action.${providerAction.status}`,
      `${providerAction.status === "queued" ? "Queued" : "Blocked"} provider action ${providerAction.operation} for ${providerAction.provider}.`,
      now,
    ]);
    await insertTraceEvent(env, db, {
      id: `trace_event_${providerAction.status}_${providerAction.id}`,
      traceId: providerAction.traceId,
      signalId: providerAction.signalId,
      workflow: "provider-action",
      span: `provider:${providerAction.provider}`,
      type: `provider_action.${providerAction.status}`,
      message: `${providerAction.status === "queued" ? "Queued" : "Blocked"} provider action ${providerAction.operation} for ${providerAction.provider}.`,
      payload: {
        providerActionId: providerAction.id,
        approvalId: providerAction.approvalId,
        draftId: providerAction.draftId ?? null,
        operation: providerAction.operation,
        provider: providerAction.provider,
      },
    });
  }

  return {
    enabled: true,
    tables: providerAction
      ? ["trellis_approvals", "trellis_provider_actions", "trellis_audit_events", "trellis_trace_events"]
      : ["trellis_approvals", "trellis_audit_events", "trellis_trace_events"],
  };
}

async function enqueueApprovalDecision(
  env: Record<string, unknown> | undefined,
  decision: TrellisApprovalDecision,
  providerAction: TrellisProviderAction | null,
) {
  const queue = env?.TRELLIS_EVENTS as TrellisQueue | undefined;
  if (!queue?.send) {
    return {
      enabled: false,
    };
  }

  let messages = 1;
  await queue.send({
    type: "trellis.approval.decided",
    traceId: providerAction?.traceId ?? decision.traceId ?? traceIdForSignalId(decision.signalId),
    approvalId: decision.approvalId,
    signalId: decision.signalId,
    status: decision.status,
    action: decision.action,
    actor: decision.actor,
    reason: decision.reason,
    providerActionId: providerAction?.id,
  });
  if (providerAction) {
    await queue.send({
      type: providerAction.status === "queued"
        ? "trellis.provider.action.queued"
        : "trellis.provider.action.blocked",
      traceId: providerAction.traceId,
      providerAction,
    });
    messages += 1;
  }
  return {
    enabled: true,
    messages,
  };
}

async function recordProviderActionTransition(
  env: Record<string, unknown> | undefined,
  transition: TrellisProviderActionTransition,
) {
  return {
    persistence: await persistProviderActionTransition(env, transition),
    queue: await enqueueProviderActionTransition(env, transition),
  };
}

async function persistProviderActionTransition(
  env: Record<string, unknown> | undefined,
  transition: TrellisProviderActionTransition,
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      tables: [],
    };
  }

  const now = new Date().toISOString();
  await ensureD1Schema(db);
  await runD1(db, `
    UPDATE trellis_provider_actions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `, [
    transition.status,
    now,
    transition.providerActionId,
  ]);
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_audit_events
      (id, signal_id, workflow, type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    `evt_provider_action_${transition.status}_${transition.providerActionId}`,
    transition.signalId,
    "provider-action",
    `provider_action.${transition.status}`,
    `${transition.status === "completed" ? "Completed" : "Failed"} provider action ${transition.providerActionId}.`,
    now,
  ]);
  await insertTraceEvent(env, db, {
    id: `trace_event_provider_action_${transition.status}_${transition.providerActionId}`,
    traceId: transition.traceId ?? traceIdForSignalId(transition.signalId),
    signalId: transition.signalId,
    workflow: "provider-action",
    span: "provider:side-effect",
    type: `provider_action.${transition.status}`,
    message: `${transition.status === "completed" ? "Completed" : "Failed"} provider action ${transition.providerActionId}.`,
    payload: {
      providerActionId: transition.providerActionId,
      actor: transition.actor ?? null,
      reason: transition.reason ?? null,
    },
  });

  return {
    enabled: true,
    tables: ["trellis_provider_actions", "trellis_audit_events", "trellis_trace_events"],
  };
}

async function enqueueProviderActionTransition(
  env: Record<string, unknown> | undefined,
  transition: TrellisProviderActionTransition,
) {
  const queue = env?.TRELLIS_EVENTS as TrellisQueue | undefined;
  if (!queue?.send) {
    return {
      enabled: false,
    };
  }

  await queue.send({
    type: transition.status === "completed"
      ? "trellis.provider.action.completed"
      : "trellis.provider.action.failed",
    traceId: transition.traceId ?? traceIdForSignalId(transition.signalId),
    providerActionId: transition.providerActionId,
    signalId: transition.signalId,
    status: transition.status,
    actor: transition.actor,
    reason: transition.reason,
  });
  return {
    enabled: true,
    messages: 1,
  };
}

async function executeProviderAction(
  env: Record<string, unknown> | undefined,
  execution: TrellisProviderActionExecutionRequest,
  config: TrellisAgentConfig,
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      status: 501,
      body: {
        ok: false,
        error: "provider_action_state_unavailable",
        detail: "TRELLIS_DB is required before provider actions can execute.",
      },
    };
  }

  await ensureD1Schema(db);
  const action = await readProviderActionRecord(db, execution.providerActionId);
  if (!action) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "provider_action_not_found",
        providerActionId: execution.providerActionId,
      },
    };
  }

  const context = await readProviderActionContext(db, action, execution.input ?? {});
  const controls = await readOperatorControls(env, context.signal);
  if (controls.blocked) {
    return {
      status: 423,
      body: {
        ok: false,
        error: "operator_control_active",
        detail: controls.reasons.join("; "),
        providerAction: action,
        controls,
      },
    };
  }

  if (config.safety?.noSends !== false) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "no_send_mode_enabled",
        detail: "Trellis refused to execute a provider action while no-send mode is enabled.",
        providerAction: action,
      },
    };
  }

  if (action.status !== "queued") {
    return {
      status: 409,
      body: {
        ok: false,
        error: "provider_action_not_queued",
        detail: `Provider action ${action.id} is ${action.status}, not queued.`,
        providerAction: action,
      },
    };
  }

  try {
    const result = await dispatchProviderAction(env, context, config);
    const transition = await recordProviderActionTransition(env, {
      providerActionId: action.id,
      traceId: action.traceId,
      signalId: action.signalId,
      status: "completed",
      actor: execution.actor ?? "trellis-provider-executor",
      reason: execution.reason ?? `Executed ${action.operation} through ${action.provider}.`,
    });
    const followUpWorkflow = await scheduleFollowUpWorkflow(env, context, result, config).catch((followUpError: unknown) => ({
      enabled: true,
      ok: false,
      workflow: "follow_up",
      error: followUpError instanceof Error ? followUpError.message : String(followUpError),
    }));
    return {
      status: 200,
      body: {
        ok: true,
        providerAction: {
          ...action,
          status: "completed",
        },
        execution: result,
        followUpWorkflow,
        ...transition,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const transition = await recordProviderActionTransition(env, {
      providerActionId: action.id,
      traceId: action.traceId,
      signalId: action.signalId,
      status: "failed",
      actor: execution.actor ?? "trellis-provider-executor",
      reason: message,
    });
    return {
      status: 502,
      body: {
        ok: false,
        error: "provider_action_execution_failed",
        detail: message,
        providerAction: {
          ...action,
          status: "failed",
        },
        ...transition,
      },
    };
  }
}

async function drainTrellisQueue(
  batch: TrellisQueueBatch,
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
) {
  const results = [];
  for (const message of batch.messages) {
    const queuedAction = readQueuedProviderActionMessage(message.body);
    if (!queuedAction) {
      message.ack?.();
      results.push({
        ok: true,
        skipped: true,
        reason: "not_provider_action_queued",
      });
      continue;
    }

    const execution = await executeProviderAction(env, {
      providerActionId: queuedAction.providerActionId,
      actor: "trellis-queue",
      reason: "Drained queued provider action from TRELLIS_EVENTS.",
      input: queuedAction.input,
    }, config);
    let retryState = null;
    if (execution.status >= 500) {
      retryState = await markProviderActionQueuedForQueueRetry(env, queuedAction.providerActionId, {
        actor: "trellis-queue",
        reason: isRecord(execution.body)
          ? readString(execution.body.detail) ?? readString(execution.body.error)
          : `Provider action ${queuedAction.providerActionId} failed during queue drain.`,
      });
      message.retry?.();
    } else {
      message.ack?.();
    }
    results.push({
      ok: execution.status >= 200 && execution.status < 300,
      providerActionId: queuedAction.providerActionId,
      status: execution.status,
      body: execution.body,
      retryState,
    });
  }

  return {
    ok: results.every((result) => result.ok || result.skipped),
    processed: results.filter((result) => !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    results,
  };
}

async function markProviderActionQueuedForQueueRetry(
  env: Record<string, unknown> | undefined,
  providerActionId: string,
  retry: {
    actor?: string;
    reason?: string;
  },
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
    };
  }

  await ensureD1Schema(db);
  const action = await readProviderActionRecord(db, providerActionId);
  if (!action) {
    return {
      enabled: true,
      ok: false,
      error: "provider_action_not_found",
      providerActionId,
    };
  }

  return persistProviderActionReplay(env, {
    ...action,
    status: "queued",
  }, {
    actor: retry.actor,
    reason: retry.reason ?? "Prepared provider action for queue retry.",
  });
}

function readQueuedProviderActionMessage(body: unknown) {
  if (!isRecord(body) || body.type !== "trellis.provider.action.queued") {
    return null;
  }
  const providerAction = isRecord(body.providerAction) ? body.providerAction : {};
  const providerActionId = readString(body.providerActionId) ?? readString(providerAction.id);
  if (!providerActionId) {
    return null;
  }
  return {
    providerActionId,
    input: isRecord(body.input)
      ? body.input
      : isRecord(providerAction.input)
        ? providerAction.input
        : {},
  };
}

async function readProviderActionRecord(db: TrellisD1Database, providerActionId: string) {
  return await db.prepare(`
    SELECT
      id,
      approval_id AS approvalId,
      signal_id AS signalId,
      draft_id AS draftId,
      provider,
      operation,
      status,
      trace_id AS traceId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM trellis_provider_actions
    WHERE id = ?
  `).bind(providerActionId).first<TrellisProviderActionRecord>();
}

async function replayProviderAction(
  env: Record<string, unknown> | undefined,
  input: {
    providerActionId: string;
    actor?: string;
    reason?: string;
  },
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      status: 501,
      body: {
        ok: false,
        error: "provider_action_state_unavailable",
        detail: "TRELLIS_DB is required before provider actions can be replayed.",
      },
    };
  }

  await ensureD1Schema(db);
  const action = await readProviderActionRecord(db, input.providerActionId);
  if (!action) {
    return {
      status: 404,
      body: {
        ok: false,
        error: "provider_action_not_found",
        providerActionId: input.providerActionId,
      },
    };
  }
  if (action.status === "completed") {
    return {
      status: 409,
      body: {
        ok: false,
        error: "provider_action_already_completed",
        detail: `Provider action ${action.id} is already completed and cannot be replayed.`,
        providerAction: action,
      },
    };
  }

  const replayed = {
    ...action,
    status: "queued",
  } satisfies TrellisProviderActionRecord;
  const persistence = await persistProviderActionReplay(env, replayed, input);
  const queue = await enqueueProviderActionReplay(env, replayed, input);
  return {
    status: 200,
    body: {
      ok: true,
      providerAction: replayed,
      persistence,
      queue,
    },
  };
}

async function persistProviderActionReplay(
  env: Record<string, unknown> | undefined,
  action: TrellisProviderActionRecord,
  replay: {
    actor?: string;
    reason?: string;
  },
) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      tables: [],
    };
  }

  const now = new Date().toISOString();
  await ensureD1Schema(db);
  await runD1(db, `
    UPDATE trellis_provider_actions
    SET status = ?, updated_at = ?
    WHERE id = ?
  `, [
    "queued",
    now,
    action.id,
  ]);
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_audit_events
      (id, signal_id, workflow, type, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    `evt_provider_action_replayed_${action.id}`,
    action.signalId,
    "provider-action",
    "provider_action.replayed",
    `Requeued provider action ${action.id}.`,
    now,
  ]);
  await insertTraceEvent(env, db, {
    id: `trace_event_provider_action_replayed_${action.id}`,
    traceId: action.traceId,
    signalId: action.signalId,
    workflow: "provider-action",
    span: `provider:${action.provider}`,
    type: "provider_action.replayed",
    message: `Requeued provider action ${action.id}.`,
    payload: {
      providerActionId: action.id,
      actor: replay.actor ?? null,
      reason: replay.reason ?? null,
    },
  });
  return {
    enabled: true,
    tables: ["trellis_provider_actions", "trellis_audit_events", "trellis_trace_events"],
  };
}

async function enqueueProviderActionReplay(
  env: Record<string, unknown> | undefined,
  action: TrellisProviderActionRecord,
  replay: {
    actor?: string;
    reason?: string;
  },
) {
  const queue = env?.TRELLIS_EVENTS as TrellisQueue | undefined;
  if (!queue?.send) {
    return {
      enabled: false,
    };
  }
  await queue.send({
    type: "trellis.provider.action.queued",
    traceId: action.traceId,
    providerAction: action,
    input: {
      replay: true,
      actor: replay.actor,
      reason: replay.reason,
    },
  });
  return {
    enabled: true,
    messages: 1,
  };
}

async function readProviderActionContext(
  db: TrellisD1Database,
  action: TrellisProviderActionRecord,
  input: Record<string, unknown>,
): Promise<TrellisProviderExecutionContext> {
  const draft = action.draftId
    ? await db.prepare(`
        SELECT
          id,
          signal_id AS signalId,
          channel,
          status,
          body
        FROM trellis_drafts
        WHERE id = ?
      `).bind(action.draftId).first<TrellisDraftRecord>()
    : null;
  const signal = await db.prepare(`
    SELECT
      id,
      workspace_id AS workspaceId,
      thread_id AS threadId,
      campaign_id AS campaignId,
      payload_json AS payloadJson
    FROM trellis_signals
    WHERE id = ?
  `).bind(action.signalId).first<Record<string, unknown>>();
  const prospect = await db.prepare(`
    SELECT
      id,
      signal_id AS signalId,
      workspace_id AS workspaceId,
      thread_id AS threadId,
      status,
      updated_at AS updatedAt
    FROM trellis_prospects
    WHERE signal_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(action.signalId).first<TrellisProspectRecord>();
  const workflowRunRow = await db.prepare(`
    SELECT
      id,
      signal_id AS signalId,
      workflow,
      status,
      params_json AS paramsJson,
      updated_at AS updatedAt
    FROM trellis_workflow_runs
    WHERE signal_id = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(action.signalId).first<Record<string, unknown>>();
  const workflowRun = workflowRunRow
    ? {
        id: String(workflowRunRow.id),
        signalId: String(workflowRunRow.signalId),
        workflow: String(workflowRunRow.workflow),
        status: String(workflowRunRow.status),
        params: parseRecordJson(workflowRunRow.paramsJson),
        updatedAt: readString(workflowRunRow.updatedAt) ?? null,
      }
    : null;

  return {
    action,
    draft,
    signal: signal
      ? {
          id: String(signal.id),
          traceId: action.traceId,
          workspaceId: String(signal.workspaceId),
          threadId: String(signal.threadId),
          campaignId: readString(signal.campaignId) ?? null,
          payload: parseRecordJson(signal.payloadJson),
        }
      : null,
    prospect: prospect
      ? {
          id: prospect.id,
          signalId: prospect.signalId,
          workspaceId: prospect.workspaceId,
          threadId: prospect.threadId,
          status: prospect.status,
          updatedAt: prospect.updatedAt,
        }
      : null,
    workflowRun,
    input,
  };
}

async function dispatchProviderAction(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
  config: TrellisAgentConfig,
): Promise<TrellisProviderActionExecutionResult> {
  const boundExecutor = await dispatchWithBoundExecutor(env, context);
  if (boundExecutor) {
    return boundExecutor;
  }

  if (
    context.action.provider === "agentmail"
    && (context.action.operation === "email.send" || context.action.operation === "mail.send")
  ) {
    return executeAgentMailSend(env, context, config);
  }

  if (
    context.action.provider === "agentmail"
    && (context.action.operation === "email.reply" || context.action.operation === "mail.reply")
  ) {
    return executeAgentMailReply(env, context, config);
  }

  if (context.action.provider === "mail" && (context.action.operation === "mail.send" || context.action.operation === "email.send")) {
    return executeNativeMailSend(env, context);
  }

  if (
    context.action.provider === "mail"
    && (context.action.operation === "mail.reply" || context.action.operation === "email.reply")
  ) {
    return executeNativeMailReply(env, context);
  }

  if (context.action.provider === "mail" && context.action.operation === "mail.forward") {
    return executeNativeMailForward(env, context);
  }

  if (context.action.provider === "mail" && context.action.operation === "mail.reject") {
    return executeNativeMailReject(env, context);
  }

  if (
    context.action.provider === "attio"
    && (context.action.operation === "crm.update" || context.action.operation === "crm.syncProspect")
  ) {
    return executeAttioCrmUpdate(env, context, readAttioMap(config.crm));
  }

  if (context.action.provider === "handoff" && context.action.operation === "handoff.webhook") {
    return executeHandoffWebhook(env, context);
  }

  throw new Error(`No executor is configured for ${context.action.provider}:${context.action.operation}`);
}

async function dispatchWithBoundExecutor(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult | null> {
  const executor = env?.TRELLIS_PROVIDER_EXECUTOR as {
    execute?(context: TrellisProviderExecutionContext): Promise<TrellisProviderActionExecutionResult> | TrellisProviderActionExecutionResult;
    fetch?(request: Request): Promise<Response> | Response;
  } | undefined;
  if (!executor) {
    return null;
  }
  if (typeof executor.execute === "function") {
    return await executor.execute(context);
  }
  if (typeof executor.fetch === "function") {
    const response = await executor.fetch(new Request("https://trellis.local/provider-actions/execute", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...trellisProviderHeaders(context),
      },
      body: JSON.stringify(context),
    }));
    if (!response.ok) {
      throw new Error(`Provider executor binding failed with ${response.status}: ${await response.text()}`);
    }
    const body = await response.json();
    if (!isRecord(body)) {
      throw new Error("Provider executor binding returned a non-object response.");
    }
    return {
      ok: body.ok !== false,
      provider: readString(body.provider) ?? context.action.provider,
      operation: readString(body.operation) ?? context.action.operation,
      actionId: readString(body.actionId) ?? context.action.id,
      externalId: readString(body.externalId) ?? null,
      externalThreadId: readString(body.externalThreadId) ?? null,
      raw: body.raw ?? body,
    };
  }
  return null;
}

function trellisProviderHeaders(context: TrellisProviderExecutionContext) {
  const metadata = trellisProviderMetadata(context);
  const headers: Record<string, string> = {};
  addHeaderIfString(headers, "x-trellis-trace-id", metadata.traceId);
  addHeaderIfString(headers, "x-trellis-provider-action-id", metadata.providerActionId);
  addHeaderIfString(headers, "x-trellis-signal-id", metadata.signalId);
  addHeaderIfString(headers, "x-trellis-draft-id", metadata.draftId);
  addHeaderIfString(headers, "x-trellis-workflow", metadata.workflow);
  addHeaderIfString(headers, "x-trellis-prospect-id", metadata.prospectId);
  addHeaderIfString(headers, "x-trellis-thread-id", metadata.threadId);
  addHeaderIfString(headers, "x-trellis-workspace-id", metadata.workspaceId);
  addHeaderIfString(headers, "x-trellis-campaign-id", metadata.campaignId);
  return headers;
}

function trellisProviderMetadata(context: TrellisProviderExecutionContext) {
  return {
    traceId: context.action.traceId,
    providerActionId: context.action.id,
    signalId: context.action.signalId,
    draftId: context.action.draftId,
    workflow: workflowForProviderAction(context),
    prospectId: context.prospect?.id ?? (context.signal ? `prospect_${context.signal.id}` : undefined),
    threadId: context.signal?.threadId ?? context.prospect?.threadId,
    workspaceId: context.signal?.workspaceId ?? context.prospect?.workspaceId,
    campaignId: context.signal?.campaignId ?? undefined,
  };
}

function workflowForProviderAction(context: TrellisProviderExecutionContext) {
  if (
    context.action.operation === "mail.reply"
    || context.action.operation === "email.reply"
    || context.action.approvalId.includes("_reply_")
    || context.action.draftId?.startsWith("reply_")
  ) {
    return "reply";
  }
  return "prospect";
}

function addHeaderIfString(headers: Record<string, string>, name: string, value: string | null | undefined) {
  const headerValue = readString(value);
  if (headerValue) {
    headers[name] = headerValue;
  }
}

function resolveAgentMailDefaultInboxId(
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
) {
  const sequence = readAgentMailSequence(resolveMailProvider(config));
  const configured = sequence?.defaultInboxId ?? readString(env?.AGENTMAIL_INBOX_ID);
  if (!configured) {
    return undefined;
  }
  if (configured.startsWith("env:")) {
    return readString(env?.[configured.slice("env:".length)]);
  }
  return configured;
}

type TrellisNativeMailBinding = {
  send?(message: Record<string, unknown>): Promise<unknown> | unknown;
  reply?(message: Record<string, unknown>): Promise<unknown> | unknown;
  forward?(message: Record<string, unknown>): Promise<unknown> | unknown;
  reject?(message: Record<string, unknown>): Promise<unknown> | unknown;
};

async function executeNativeMailSend(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const to = readFirstString(input, signalPayload, ["to", "recipient", "recipientEmail", "email"]);
  const from = readFirstString(input, signalPayload, ["from", "sender"]) ?? readString(env?.TRELLIS_MAIL_FROM);
  const replyTo = readFirstString(input, signalPayload, ["replyTo", "reply_to"]) ?? readString(env?.TRELLIS_MAIL_REPLY_TO);
  const subject = readFirstString(input, signalPayload, ["subject"]) ?? "Trellis outreach";
  const bodyText = readFirstString(input, signalPayload, ["bodyText", "text", "body"]) ?? context.draft?.body;
  const bodyHtml = readFirstString(input, signalPayload, ["bodyHtml", "html"]);

  if (!to) {
    throw new Error("mail.send requires a recipient email.");
  }
  if (!from) {
    throw new Error("mail.send requires TRELLIS_MAIL_FROM or input.from.");
  }
  if (!bodyText && !bodyHtml) {
    throw new Error("mail.send requires bodyText, bodyHtml, or a draft body.");
  }

  const raw = await sendNativeMail(env, {
    type: "send",
    from,
    to: [to],
    replyTo,
    subject,
    text: bodyText,
    html: bodyHtml,
    headers: trellisProviderHeaders(context),
  });
  const record = isRecord(raw) ? raw : {};
  return {
    ok: true,
    provider: "mail",
    operation: context.action.operation,
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.messageId) ?? readString(record.message_id) ?? null,
    externalThreadId: readString(record.threadId) ?? readString(record.thread_id) ?? null,
    raw,
  };
}

async function executeNativeMailReply(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const messageId = readFirstString(input, signalPayload, [
    "messageId",
    "providerMessageId",
    "inboundMessageId",
    "replyToMessageId",
    "replyToProviderMessageId",
  ]);
  const from = readFirstString(input, signalPayload, ["from", "sender"]) ?? readString(env?.TRELLIS_MAIL_FROM);
  const to = readFirstString(input, signalPayload, ["to", "recipient", "recipientEmail", "email"]);
  const subject = readFirstString(input, signalPayload, ["subject"]);
  const bodyText = readFirstString(input, signalPayload, ["bodyText", "text", "body"]) ?? context.draft?.body;
  const bodyHtml = readFirstString(input, signalPayload, ["bodyHtml", "html"]);

  if (!messageId) {
    throw new Error("mail.reply requires messageId or providerMessageId.");
  }
  if (!from) {
    throw new Error("mail.reply requires TRELLIS_MAIL_FROM or input.from.");
  }
  if (!bodyText && !bodyHtml) {
    throw new Error("mail.reply requires bodyText, bodyHtml, or a draft body.");
  }

  const raw = await sendNativeMail(env, {
    type: "reply",
    from,
    to: to ? [to] : undefined,
    subject,
    text: bodyText,
    html: bodyHtml,
    inReplyTo: messageId,
    references: messageId,
    headers: trellisProviderHeaders(context),
  });
  const record = isRecord(raw) ? raw : {};
  return {
    ok: true,
    provider: "mail",
    operation: context.action.operation,
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.messageId) ?? readString(record.message_id) ?? null,
    externalThreadId: readString(record.threadId) ?? readString(record.thread_id) ?? readString(record.threadId) ?? null,
    raw,
  };
}

async function executeNativeMailForward(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const messageId = readFirstString(input, signalPayload, ["messageId", "providerMessageId", "inboundMessageId"]);
  const to = readFirstString(input, signalPayload, ["to", "recipient", "recipientEmail", "email"]);
  const from = readFirstString(input, signalPayload, ["from", "sender"]) ?? readString(env?.TRELLIS_MAIL_FROM);
  const bodyText = readFirstString(input, signalPayload, ["bodyText", "text", "body"]);

  if (!messageId) {
    throw new Error("mail.forward requires messageId or providerMessageId.");
  }
  if (!to) {
    throw new Error("mail.forward requires a recipient email.");
  }

  const raw = await sendNativeMail(env, {
    type: "forward",
    from,
    to: [to],
    messageId,
    text: bodyText,
    headers: trellisProviderHeaders(context),
  });
  const record = isRecord(raw) ? raw : {};
  return {
    ok: true,
    provider: "mail",
    operation: context.action.operation,
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.messageId) ?? readString(record.message_id) ?? null,
    externalThreadId: readString(record.threadId) ?? readString(record.thread_id) ?? null,
    raw,
  };
}

async function executeNativeMailReject(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const messageId = readFirstString(input, signalPayload, ["messageId", "providerMessageId", "inboundMessageId"]);
  const reason = readFirstString(input, signalPayload, ["reason", "message"]) ?? "Rejected by Trellis policy.";

  if (!messageId) {
    throw new Error("mail.reject requires messageId or providerMessageId.");
  }

  const raw = await sendNativeMail(env, {
    type: "reject",
    messageId,
    reason,
    headers: trellisProviderHeaders(context),
  });
  const record = isRecord(raw) ? raw : {};
  return {
    ok: true,
    provider: "mail",
    operation: context.action.operation,
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.messageId) ?? readString(record.message_id) ?? messageId,
    externalThreadId: readString(record.threadId) ?? readString(record.thread_id) ?? null,
    raw,
  };
}

async function sendNativeMail(env: Record<string, unknown> | undefined, message: Record<string, unknown>) {
  const binding = (env?.TRELLIS_MAIL ?? env?.MAIL) as TrellisNativeMailBinding | undefined;
  if (binding?.forward && message.type === "forward") {
    return await binding.forward(message);
  }
  if (binding?.reject && message.type === "reject") {
    return await binding.reject(message);
  }
  if (binding?.send && message.type !== "reply") {
    return await binding.send(message);
  }
  if (binding?.reply && message.type === "reply") {
    return await binding.reply(message);
  }
  if (binding?.send && message.type === "reply") {
    return await binding.send(message);
  }
  const endpoint = readString(env?.TRELLIS_MAIL_ENDPOINT);
  const token = readString(env?.TRELLIS_MAIL_TOKEN);
  if (!endpoint) {
    throw new Error("Native mail requires TRELLIS_MAIL binding, MAIL binding, or TRELLIS_MAIL_ENDPOINT.");
  }
  const response = await runtimeFetch(env, endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`mail provider failed with ${response.status}: ${await response.text()}`);
  }
  return await response.json().catch(() => ({}));
}

async function executeAgentMailSend(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
  config: TrellisAgentConfig,
): Promise<TrellisProviderActionExecutionResult> {
  const apiKey = readString(env?.AGENTMAIL_API_KEY);
  if (!apiKey) {
    throw new Error("AGENTMAIL_API_KEY is not configured.");
  }

  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const inboxId = readFirstString(input, signalPayload, ["inboxId", "providerInboxId", "senderProviderInboxId"])
    ?? resolveAgentMailDefaultInboxId(env, config);
  const to = readFirstString(input, signalPayload, ["to", "recipient", "recipientEmail", "email"]);
  const subject = readFirstString(input, signalPayload, ["subject"]) ?? "Trellis outreach";
  const bodyText = readFirstString(input, signalPayload, ["bodyText", "text", "body"]) ?? context.draft?.body;
  const bodyHtml = readFirstString(input, signalPayload, ["bodyHtml", "html"]);

  if (!inboxId) {
    throw new Error("AgentMail send requires inboxId or providerInboxId.");
  }
  if (!to) {
    throw new Error("AgentMail send requires a recipient email.");
  }
  if (!bodyText) {
    throw new Error("AgentMail send requires bodyText or a draft body.");
  }

  const baseUrl = readString(env?.AGENTMAIL_BASE_URL) ?? "https://api.agentmail.to";
  const response = await runtimeFetch(env, `${baseUrl.replace(/\/+$/, "")}/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      ...trellisProviderHeaders(context),
    },
    body: JSON.stringify({
      to: [to],
      subject,
      text: bodyText,
      html: bodyHtml,
    }),
  });

  if (!response.ok) {
    throw new Error(`AgentMail send failed with ${response.status}: ${await response.text()}`);
  }

  const raw = await response.json().catch(() => ({}));
  const record = isRecord(raw) ? raw : {};
  return {
    ok: true,
    provider: "agentmail",
    operation: context.action.operation,
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.message_id) ?? null,
    externalThreadId: readString(record.thread_id) ?? readString(record.threadId) ?? null,
    raw,
  };
}

async function executeAgentMailReply(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
  config: TrellisAgentConfig,
): Promise<TrellisProviderActionExecutionResult> {
  const apiKey = readString(env?.AGENTMAIL_API_KEY);
  if (!apiKey) {
    throw new Error("AGENTMAIL_API_KEY is not configured.");
  }

  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const inboxId = readFirstString(input, signalPayload, ["inboxId", "providerInboxId", "senderProviderInboxId"])
    ?? resolveAgentMailDefaultInboxId(env, config);
  const messageId = readFirstString(input, signalPayload, [
    "messageId",
    "providerMessageId",
    "inboundMessageId",
    "replyToMessageId",
    "replyToProviderMessageId",
  ]);
  const subject = readFirstString(input, signalPayload, ["subject"]);
  const bodyText = readFirstString(input, signalPayload, ["bodyText", "text", "body"]) ?? context.draft?.body;
  const bodyHtml = readFirstString(input, signalPayload, ["bodyHtml", "html"]);
  const replyAll = readBoolean(input.replyAll) ?? readBoolean(signalPayload.replyAll) ?? true;

  if (!inboxId) {
    throw new Error("AgentMail reply requires inboxId or providerInboxId.");
  }
  if (!messageId) {
    throw new Error("AgentMail reply requires messageId or providerMessageId.");
  }
  if (!bodyText) {
    throw new Error("AgentMail reply requires bodyText or a draft body.");
  }

  const baseUrl = readString(env?.AGENTMAIL_BASE_URL) ?? "https://api.agentmail.to";
  const response = await runtimeFetch(env,
    `${baseUrl.replace(/\/+$/, "")}/v0/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/${replyAll ? "reply-all" : "reply"}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...trellisProviderHeaders(context),
      },
      body: JSON.stringify({
        text: bodyText,
        html: bodyHtml,
        subject,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`AgentMail reply failed with ${response.status}: ${await response.text()}`);
  }

  const raw = await response.json().catch(() => ({}));
  const record = isRecord(raw) ? raw : {};
  return {
    ok: true,
    provider: "agentmail",
    operation: context.action.operation,
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.message_id) ?? null,
    externalThreadId: readString(record.thread_id) ?? readString(record.threadId) ?? null,
    raw,
  };
}

async function executeAttioCrmUpdate(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
  map: TrellisAttioMap | null = null,
): Promise<TrellisProviderActionExecutionResult> {
  const apiKey = readString(env?.ATTIO_API_KEY);
  if (!apiKey) {
    throw new Error("ATTIO_API_KEY is not configured.");
  }

  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const companyName = readFirstString(input, signalPayload, [
    "companyName",
    "company",
    "account",
    "accountName",
    "organization",
  ]);
  const companyDomain = normalizeDomain(readFirstString(input, signalPayload, [
    "companyDomain",
    "domain",
    "website",
    "companyWebsite",
  ]));
  const fullName = readFirstString(input, signalPayload, ["fullName", "name", "personName", "contactName"]);
  const email = readFirstString(input, signalPayload, ["email", "recipientEmail", "personEmail", "contactEmail"]);
  const title = readFirstString(input, signalPayload, ["title", "jobTitle"]);
  const linkedinUrl = readFirstString(input, signalPayload, ["linkedinUrl", "linkedin"]);
  const twitterUrl = readFirstString(input, signalPayload, ["twitterUrl", "twitter", "xUrl"]);
  const companyRecordId = readFirstString(input, signalPayload, ["attioCompanyRecordId", "companyRecordId"]);
  const personRecordId = readFirstString(input, signalPayload, ["attioPersonRecordId", "personRecordId"]);
  const mapSource = buildAttioMapSource(context);
  const mappedCompanyValues = normalizeAttioCompanyMappedValues(applyAttioFieldMap(map?.companies, mapSource));
  const mappedPersonValues = normalizeAttioPersonMappedValues(applyAttioFieldMap(map?.people, mapSource));
  const hasCompanyUpdate = Boolean(companyName || companyDomain);
  const hasPersonUpdate = Boolean(personRecordId || fullName || email || linkedinUrl || twitterUrl);
  const hasMappedCompanyUpdate = Object.keys(mappedCompanyValues).length > 0;
  const hasMappedPersonUpdate = Object.keys(mappedPersonValues).length > 0;
  const companyValues = {
    ...buildAttioCompanyValues(companyName, companyDomain),
    ...mappedCompanyValues,
  };

  if (!hasCompanyUpdate && !hasPersonUpdate && !hasMappedCompanyUpdate && !hasMappedPersonUpdate) {
    throw new Error("Attio CRM update requires company, domain, email, name, LinkedIn, or an Attio record id.");
  }

  const baseUrl = (readString(env?.ATTIO_BASE_URL) ?? "https://api.attio.com/v2").replace(/\/+$/, "");
  const providerHeaders = trellisProviderHeaders(context);
  const company = companyRecordId && (hasCompanyUpdate || hasMappedCompanyUpdate)
    ? await attioRequest(env, apiKey, baseUrl, `/objects/companies/records/${encodeURIComponent(companyRecordId)}`, "PATCH", {
        data: {
          values: companyValues,
        },
      }, providerHeaders)
    : (hasCompanyUpdate || hasMappedCompanyUpdate)
      ? await attioRequest(env, apiKey, baseUrl, companyDomain
          ? "/objects/companies/records?matching_attribute=domains"
          : "/objects/companies/records", companyDomain ? "PUT" : "POST", {
            data: {
              values: companyValues,
            },
          }, providerHeaders)
      : null;
  const companyRef = company
    ? mapAttioRecordReference(company)
    : companyRecordId
      ? { recordId: companyRecordId, webUrl: null }
      : null;
  const personValues = hasPersonUpdate
    ? buildAttioPersonValues({
        fullName,
        email,
        title,
        linkedinUrl,
        twitterUrl,
        companyRecordId: companyRef?.recordId,
        companyDomain,
      })
    : null;
  const person = personRecordId && (personValues || hasMappedPersonUpdate)
    ? await attioRequest(env, apiKey, baseUrl, `/objects/people/records/${encodeURIComponent(personRecordId)}`, "PATCH", {
        data: { values: { ...(personValues ?? {}), ...mappedPersonValues } },
      }, providerHeaders)
    : personValues
      ? await attioRequest(env, apiKey, baseUrl, email
          ? "/objects/people/records?matching_attribute=email_addresses"
          : "/objects/people/records", email ? "PUT" : "POST", {
            data: { values: { ...personValues, ...mappedPersonValues } },
          }, providerHeaders)
      : hasMappedPersonUpdate
      ? await attioRequest(env, apiKey, baseUrl, "/objects/people/records", "POST", {
          data: { values: mappedPersonValues },
        }, providerHeaders)
      : null;
  const personRef = person ? mapAttioRecordReference(person) : null;

  return {
    ok: true,
    provider: "attio",
    operation: context.action.operation,
    actionId: context.action.id,
    externalId: personRef?.recordId || companyRef?.recordId || null,
    raw: {
      company: companyRef,
      person: personRef,
      attio: {
        company,
        person,
      },
    },
  };
}

function readAttioMap(provider: TrellisProviderDefinition | undefined): TrellisAttioMap | null {
  const config = isRecord(provider?.config) ? provider.config : {};
  const map = isRecord(config.map) ? config.map : null;
  if (!map) {
    return null;
  }
  return {
    companies: readStringFieldMap(map.companies),
    people: readStringFieldMap(map.people),
  };
}

function readStringFieldMap(value: unknown): TrellisFieldMap | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value)
    .filter((entry): entry is [string, string] =>
      typeof entry[0] === "string" && typeof entry[1] === "string" && entry[0].trim().length > 0 && entry[1].trim().length > 0,
    );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function buildAttioMapSource(context: TrellisProviderExecutionContext) {
  const signal = context.signal
    ? {
        id: context.signal.id,
        traceId: context.signal.traceId,
        workspaceId: context.signal.workspaceId,
        threadId: context.signal.threadId,
        campaignId: context.signal.campaignId ?? null,
        payload: context.signal.payload,
      }
    : null;
  const params = context.workflowRun?.params ?? {};
  return {
    ...context.input,
    ...(context.signal?.payload ?? {}),
    ...params,
    input: context.input,
    signal,
    payload: context.signal?.payload ?? {},
    draft: context.draft,
    prospect: context.prospect,
    action: context.action,
    workflow: context.workflowRun,
  };
}

function applyAttioFieldMap(map: TrellisFieldMap | undefined, source: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const [attioField, sourcePath] of Object.entries(map ?? {})) {
    const value = readMappedValue(source, sourcePath);
    if (value !== undefined && value !== null && value !== "") {
      values[attioField] = value;
    }
  }
  return values;
}

function normalizeAttioCompanyMappedValues(values: Record<string, unknown>) {
  const normalized = { ...values };
  if (typeof normalized.domains === "string") {
    const domain = normalizeDomain(normalized.domains);
    normalized.domains = domain ? [domain] : [normalized.domains];
  }
  return normalized;
}

function normalizeAttioPersonMappedValues(values: Record<string, unknown>) {
  const normalized = { ...values };
  if (typeof normalized.name === "string") {
    const { firstName, lastName } = splitFullName(normalized.name);
    normalized.name = [
      {
        first_name: firstName,
        last_name: lastName,
        full_name: normalized.name,
      },
    ];
  }
  if (typeof normalized.email_addresses === "string") {
    normalized.email_addresses = [normalized.email_addresses];
  }
  return normalized;
}

function readMappedValue(source: Record<string, unknown>, sourcePath: string) {
  const pathParts = sourcePath.replace(/^\$\./, "").split(".").filter(Boolean);
  let cursor: unknown = source;
  for (const part of pathParts) {
    if (Array.isArray(cursor)) {
      const index = Number(part);
      cursor = Number.isInteger(index) ? cursor[index] : undefined;
      continue;
    }
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

async function executeHandoffWebhook(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const webhookUrl = readString(env?.HANDOFF_WEBHOOK_URL) ?? readString(env?.TRELLIS_HANDOFF_WEBHOOK_URL);
  if (!webhookUrl) {
    throw new Error("HANDOFF_WEBHOOK_URL or TRELLIS_HANDOFF_WEBHOOK_URL is not configured.");
  }

  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const reason = readFirstString(input, signalPayload, ["reason", "handoffReason", "disposition"])
    ?? context.draft?.body
    ?? "Trellis handoff requested.";
  const destination = readFirstString(input, signalPayload, ["destination", "channel", "team"]) ?? "sales";
  const metadata = trellisProviderMetadata(context);
  const payload = {
    type: "trellis.handoff.requested",
    traceId: context.action.traceId,
    providerActionId: context.action.id,
    signalId: context.action.signalId,
    draftId: metadata.draftId ?? null,
    workflow: metadata.workflow,
    prospectId: metadata.prospectId ?? null,
    threadId: context.signal?.threadId ?? null,
    workspaceId: context.signal?.workspaceId ?? null,
    campaignId: metadata.campaignId ?? null,
    destination,
    reason,
    draft: context.draft,
    input,
    signal: signalPayload,
  };
  const fetcher = typeof env?.TRELLIS_FETCH === "function"
    ? env.TRELLIS_FETCH as typeof fetch
    : fetch;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...trellisProviderHeaders(context),
  };
  const secret = readString(env?.HANDOFF_WEBHOOK_SECRET) ?? readString(env?.TRELLIS_HANDOFF_WEBHOOK_SECRET);
  if (secret) {
    headers["x-trellis-handoff-secret"] = secret;
  }
  const response = await fetcher(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Handoff webhook failed with ${response.status}: ${await response.text()}`);
  }
  const raw = await response.json().catch(() => ({}));
  const record = isRecord(raw) ? raw : {};
  return {
    ok: true,
    provider: "handoff",
    operation: "handoff.webhook",
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.handoffId) ?? null,
    raw,
  };
}

function buildAttioCompanyValues(companyName: string | undefined, companyDomain: string | undefined) {
  const values: Record<string, unknown> = {};
  if (companyName) {
    values.name = companyName;
  }
  if (companyDomain) {
    values.domains = [companyDomain];
  }
  return values;
}

function buildAttioPersonValues(input: {
  fullName?: string;
  email?: string;
  title?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  companyRecordId?: string;
  companyDomain?: string;
}) {
  const values: Record<string, unknown> = {};
  if (input.fullName) {
    const { firstName, lastName } = splitFullName(input.fullName);
    values.name = [
      {
        first_name: firstName,
        last_name: lastName,
        full_name: input.fullName,
      },
    ];
  }
  if (input.email) {
    values.email_addresses = [input.email];
  }
  if (input.title) {
    values.job_title = input.title;
  }
  if (input.linkedinUrl) {
    values.linkedin = input.linkedinUrl;
  }
  if (input.twitterUrl) {
    values.twitter = input.twitterUrl;
  }
  if (input.companyRecordId) {
    values.company = [
      {
        target_object: "companies",
        target_record_id: input.companyRecordId,
      },
    ];
  } else if (input.companyDomain) {
    values.company = [
      {
        target_object: "companies",
        domains: [{ domain: input.companyDomain }],
      },
    ];
  }
  return values;
}

async function attioRequest(
  env: Record<string, unknown> | undefined,
  apiKey: string,
  baseUrl: string,
  path: string,
  method: "POST" | "PUT" | "PATCH",
  body: Record<string, unknown>,
  trellisHeaders: Record<string, string> = {},
) {
  const fetcher = typeof env?.TRELLIS_FETCH === "function"
    ? env.TRELLIS_FETCH as typeof fetch
    : fetch;
  const response = await fetcher(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      ...trellisHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Attio request failed with ${response.status}: ${await response.text()}`);
  }
  const parsed = await response.json().catch(() => ({}));
  return isRecord(parsed) ? parsed : {};
}

function mapAttioRecordReference(response: Record<string, unknown>) {
  const data = isRecord(response.data) ? response.data : {};
  const id = isRecord(data.id) ? data.id : {};
  return {
    recordId: readString(id.record_id) ?? readString(id.id) ?? "",
    webUrl: readString(data.web_url) ?? null,
  };
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? fullName,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

function normalizeDomain(value: string | undefined) {
  return value
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

async function executeFirecrawlSearch(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const query = readFirstString(input, {}, ["query", "q"]);
  const queries = query ? [query] : readStringArray(input.queries).slice(0, 5);
  if (queries.length === 0) {
    throw new Error("Firecrawl search requires a query.");
  }

  const limit = readNumber(input.limit) ?? 5;
  const sources = readFirecrawlSources(input.sources);
  const responses = [];
  const results = [];
  for (const currentQuery of queries) {
    const response = await firecrawlRequest(env, "POST", "/v2/search", {
      query: currentQuery,
      limit,
      sources,
      ...pickFirecrawlInput(input, [
        "categories",
        "includeDomains",
        "excludeDomains",
        "location",
        "scrapeOptions",
        "enterprise",
        "filter",
        "timeout",
      ]),
      country: readString(input.country) ?? "US",
      ignoreInvalidURLs: true,
      ...(readString(input.tbs) ? { tbs: readString(input.tbs) } : {}),
    });
    responses.push(response);
    const data = isRecord(response.data) ? response.data : {};
    const webResults = Array.isArray(data.web) ? data.web : [];
    const imageResults = Array.isArray(data.images) ? data.images : [];
    const newsResults = Array.isArray(data.news) ? data.news : [];
    const arrayResults = Array.isArray(response.data) ? response.data : [];
    results.push(
      ...arrayResults.map((result) => mapFirecrawlSearchResult(result, "web")),
      ...webResults.map((result) => mapFirecrawlSearchResult(result, "web")),
      ...imageResults.map((result) => mapFirecrawlSearchResult(result, "images")),
      ...newsResults.map((result) => mapFirecrawlSearchResult(result, "news")),
    );
  }

  return {
    provider: "firecrawl",
    operation: "research.search",
    query: queries[0],
    queries,
    results: results.filter((result) => Boolean(result.url)),
    raw: queries.length === 1 ? responses[0] : responses,
  };
}

async function executeFirecrawlScrape(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const url = readFirstString(input, {}, ["url"]);
  if (!url) {
    throw new Error("Firecrawl scrape requires a URL.");
  }

  const response = await firecrawlRequest(env, "POST", "/v2/scrape", {
    url,
    formats: readStringArray(input.formats).length > 0 ? readStringArray(input.formats) : ["markdown"],
    ...pickFirecrawlInput(input, [
      "onlyMainContent",
      "onlyCleanContent",
      "includeTags",
      "excludeTags",
      "maxAge",
      "minAge",
      "headers",
      "waitFor",
      "mobile",
      "skipTlsVerification",
      "timeout",
      "parsers",
      "actions",
      "location",
      "removeBase64Images",
      "blockAds",
      "proxy",
      "storeInCache",
      "lockdown",
      "zeroDataRetention",
    ]),
  });
  return normalizeFirecrawlScrapeResult("research.scrape", url, response);
}

async function executeFirecrawlExtract(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const url = readFirstString(input, {}, ["url"]);
  if (!url) {
    throw new Error("Firecrawl extract requires a URL.");
  }

  const response = await firecrawlRequest(env, "POST", "/v2/scrape", {
    url,
    formats: ["markdown"],
    onlyMainContent: true,
  });
  return normalizeFirecrawlScrapeResult("research.extract", url, response);
}

async function executeFirecrawlStructuredExtract(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const urls = readStringArray(input.urls);
  const prompt = readString(input.prompt);
  if (urls.length === 0) {
    throw new Error("Firecrawl structured extract requires urls.");
  }
  if (!prompt) {
    throw new Error("Firecrawl structured extract requires a prompt.");
  }
  const response = await firecrawlRequest(env, "POST", "/v2/extract", {
    urls,
    prompt,
    ...pickFirecrawlInput(input, ["schema", "allowExternalLinks", "enableWebSearch", "includeSubdomains"]),
  });
  return {
    provider: "firecrawl",
    operation: "research.extract.structured",
    urls,
    prompt,
    raw: response,
  };
}

async function executeFirecrawlMap(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const url = readFirstString(input, {}, ["url"]);
  if (!url) {
    throw new Error("Firecrawl map requires a URL.");
  }
  const response = await firecrawlRequest(env, "POST", "/v2/map", {
    url,
    ...pickFirecrawlInput(input, [
      "search",
      "sitemap",
      "includeSubdomains",
      "ignoreQueryParameters",
      "ignoreCache",
      "limit",
      "location",
      "timeout",
    ]),
  });
  return {
    provider: "firecrawl",
    operation: "research.map",
    url,
    links: Array.isArray(response.links) ? response.links : [],
    raw: response,
  };
}

async function executeFirecrawlCrawlStart(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const url = readFirstString(input, {}, ["url"]);
  if (!url) {
    throw new Error("Firecrawl crawl requires a URL.");
  }
  const response = await firecrawlRequest(env, "POST", "/v2/crawl", {
    url,
    ...pickFirecrawlInput(input, [
      "prompt",
      "excludePaths",
      "includePaths",
      "maxDiscoveryDepth",
      "sitemap",
      "ignoreQueryParameters",
      "regexOnFullURL",
      "limit",
      "crawlEntireDomain",
      "allowExternalLinks",
      "allowSubdomains",
      "ignoreRobotsTxt",
      "robotsUserAgent",
      "delay",
      "maxConcurrency",
      "scrapeOptions",
      "zeroDataRetention",
    ]),
  });
  return {
    provider: "firecrawl",
    operation: "research.crawl.start",
    url,
    id: readString(response.id),
    raw: response,
  };
}

async function executeFirecrawlCrawlStatus(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const id = readFirstString(input, {}, ["id", "jobId", "crawlId"]);
  if (!id) {
    throw new Error("Firecrawl crawl status requires an id.");
  }
  const response = await firecrawlRequest(env, "GET", `/v2/crawl/${encodeURIComponent(id)}`);
  return {
    provider: "firecrawl",
    operation: "research.crawl.status",
    id,
    raw: response,
  };
}

async function executeFirecrawlAgentStart(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const prompt = readString(input.prompt);
  if (!prompt) {
    throw new Error("Firecrawl agent requires a prompt.");
  }
  const response = await firecrawlRequest(env, "POST", "/v2/agent", {
    prompt,
    ...pickFirecrawlInput(input, ["urls", "schema", "maxCredits", "strictConstrainToURLs", "model"]),
  });
  return {
    provider: "firecrawl",
    operation: "research.agent.start",
    id: readString(response.id),
    raw: response,
  };
}

async function executeFirecrawlAgentStatus(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const id = readFirstString(input, {}, ["id", "jobId", "agentId"]);
  if (!id) {
    throw new Error("Firecrawl agent status requires an id.");
  }
  const response = await firecrawlRequest(env, "GET", `/v2/agent/${encodeURIComponent(id)}`);
  return {
    provider: "firecrawl",
    operation: "research.agent.status",
    id,
    raw: response,
  };
}

async function executeFirecrawlBrowserCreate(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const response = await firecrawlRequest(env, "POST", "/v2/browser", pickFirecrawlInput(input, [
    "ttl",
    "activityTtl",
    "streamWebView",
    "profile",
  ]));
  return {
    provider: "firecrawl",
    operation: "browser.session.create",
    id: readString(response.id),
    raw: response,
  };
}

async function executeFirecrawlBrowserExecute(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const sessionId = readFirstString(input, {}, ["sessionId", "session_id", "id"]);
  const code = readString(input.code);
  if (!sessionId) {
    throw new Error("Firecrawl browser execute requires a sessionId.");
  }
  if (!code) {
    throw new Error("Firecrawl browser execute requires code.");
  }
  const response = await firecrawlRequest(env, "POST", `/v2/browser/${encodeURIComponent(sessionId)}/execute`, {
    code,
    ...pickFirecrawlInput(input, ["language", "timeout"]),
  });
  return {
    provider: "firecrawl",
    operation: "browser.session.execute",
    sessionId,
    raw: response,
  };
}

async function executeFirecrawlBrowserDelete(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const sessionId = readFirstString(input, {}, ["sessionId", "session_id", "id"]);
  if (!sessionId) {
    throw new Error("Firecrawl browser delete requires a sessionId.");
  }
  const response = await firecrawlRequest(env, "DELETE", `/v2/browser/${encodeURIComponent(sessionId)}`);
  return {
    provider: "firecrawl",
    operation: "browser.session.delete",
    sessionId,
    raw: response,
  };
}

async function executeFirecrawlBrowserList(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const status = readString(input.status);
  const path = status ? `/v2/browser?status=${encodeURIComponent(status)}` : "/v2/browser";
  const response = await firecrawlRequest(env, "GET", path);
  return {
    provider: "firecrawl",
    operation: "browser.session.list",
    sessions: Array.isArray(response.sessions) ? response.sessions : [],
    raw: response,
  };
}

async function executeFirecrawlInteract(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const scrapeId = readFirstString(input, {}, ["scrapeId", "scrape_id", "jobId", "id"]);
  if (!scrapeId) {
    throw new Error("Firecrawl interact requires a scrapeId.");
  }
  const prompt = readString(input.prompt);
  const code = readString(input.code);
  if (!prompt && !code) {
    throw new Error("Firecrawl interact requires prompt or code.");
  }
  const response = await firecrawlRequest(env, "POST", `/v2/scrape/${encodeURIComponent(scrapeId)}/interact`, {
    ...(prompt ? { prompt } : {}),
    ...(code ? { code } : {}),
    ...pickFirecrawlInput(input, ["language", "timeout"]),
  });
  return {
    provider: "firecrawl",
    operation: "browser.interact",
    scrapeId,
    raw: response,
  };
}

async function executeFirecrawlInteractStop(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const scrapeId = readFirstString(input, {}, ["scrapeId", "scrape_id", "jobId", "id"]);
  if (!scrapeId) {
    throw new Error("Firecrawl interact stop requires a scrapeId.");
  }
  const response = await firecrawlRequest(env, "DELETE", `/v2/scrape/${encodeURIComponent(scrapeId)}/interact`);
  return {
    provider: "firecrawl",
    operation: "browser.interact.stop",
    scrapeId,
    raw: response,
  };
}

async function firecrawlRequest(
  env: Record<string, unknown> | undefined,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
) {
  const apiKey = readString(env?.FIRECRAWL_API_KEY);
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured.");
  }
  const baseUrl = (readString(env?.FIRECRAWL_BASE_URL) ?? readString(env?.FIRECRAWL_API_URL) ?? "https://api.firecrawl.dev").replace(/\/+$/, "");
  const fetcher = typeof env?.TRELLIS_FETCH === "function"
    ? env.TRELLIS_FETCH as typeof fetch
    : fetch;
  const requestInit: RequestInit = {
    method,
    headers: {
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      authorization: `Bearer ${apiKey}`,
    },
  };
  if (method === "POST" && body) {
    requestInit.body = JSON.stringify(body);
  }
  const response = await fetcher(`${baseUrl}${path}`, requestInit);
  if (!response.ok) {
    throw new Error(`Firecrawl request failed with ${response.status}: ${await response.text()}`);
  }
  const parsed = await response.json().catch(() => ({}));
  return isRecord(parsed) ? parsed : {};
}

function normalizeFirecrawlScrapeResult(operation: "research.scrape" | "research.extract", url: string, response: Record<string, unknown>) {
  const data = isRecord(response.data) ? response.data : {};
  const metadata = isRecord(data.metadata) ? data.metadata : {};
  return {
    provider: "firecrawl",
    operation,
    url,
    markdown: readString(data.markdown) ?? "",
    html: readString(data.html),
    summary: readString(data.summary),
    scrapeId: readString(metadata.scrapeId) ?? readString(metadata.scrape_id),
    metadata,
    raw: response,
  };
}

function pickFirecrawlInput(input: Record<string, unknown>, keys: string[]) {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (input[key] !== undefined) {
      picked[key] = input[key];
    }
  }
  return picked;
}

async function executeProspeoEmailEnrich(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const apiKey = readString(env?.PROSPEO_API_KEY);
  if (!apiKey) {
    throw new Error("PROSPEO_API_KEY is not configured.");
  }

  const firstName = readFirstString(input, {}, ["firstName", "first_name"]);
  const lastName = readFirstString(input, {}, ["lastName", "last_name"]);
  const fullName = readFirstString(input, {}, ["fullName", "name", "personName", "contactName"]);
  const linkedinUrl = readFirstString(input, {}, ["linkedinUrl", "linkedin", "linkedin_url"]);
  const inputEmail = readFirstString(input, {}, ["email", "workEmail", "work_email"]);
  const personId = readFirstString(input, {}, ["personId", "person_id"]);

  const companyName = readFirstString(input, {}, ["companyName", "company", "accountName"]);
  const companyDomain = normalizeDomain(readFirstString(input, {}, ["companyDomain", "domain", "website", "companyWebsite"]));
  const companyLinkedinUrl = readFirstString(input, {}, ["companyLinkedinUrl", "company_linkedin_url"]);
  const hasName = Boolean(fullName || (firstName && lastName));
  const hasCompany = Boolean(companyName || companyDomain || companyLinkedinUrl);
  if (!linkedinUrl && !inputEmail && !personId && !(hasName && hasCompany)) {
    throw new Error("Prospeo enrichment requires linkedinUrl, email, personId, or a name plus company.");
  }

  const baseUrl = (readString(env?.PROSPEO_BASE_URL) ?? "https://api.prospeo.io").replace(/\/+$/, "");
  const response = await runtimeFetch(env, `${baseUrl}/enrich-person`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify({
      only_verified_email: true,
      data: {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        linkedin_url: linkedinUrl,
        email: inputEmail,
        person_id: personId,
        company_name: companyName,
        company_website: companyDomain,
        company_linkedin_url: companyLinkedinUrl,
      },
    }),
  });
  const responseText = await response.text();
  const json = parseRecordJson(responseText);
  if (!response.ok) {
    if (response.status === 400 && readString(json.error_code) === "NO_MATCH") {
      return {
        provider: "prospeo",
        operation: "mail.enrich",
        found: false,
        contact: null,
        raw: json,
      };
    }
    throw new Error(`Prospeo enrich-person failed with ${response.status}: ${responseText}`);
  }

  const person = isRecord(json.person) ? json.person : {};
  const emailRecord = isRecord(person.email) ? person.email : {};
  const resultEmail = readString(emailRecord.email) ?? readFirstString(json, {}, ["email", "work_email"]);
  const status = readString(emailRecord.status);
  const revealed = readBoolean(emailRecord.revealed);
  const found = Boolean(resultEmail && (!status || status === "VERIFIED") && revealed !== false);
  return {
    provider: "prospeo",
    operation: "mail.enrich",
    found,
    contact: found
      ? {
          address: resultEmail,
          confidence: status === "VERIFIED" ? 0.97 : 0.92,
          source: "prospeo",
        }
      : null,
    raw: json,
  };
}

async function executeBrowserRunQuickAction(
  env: Record<string, unknown> | undefined,
  operation: string,
  action: string,
  input: Record<string, unknown>,
  provider?: TrellisProviderDefinition,
) {
  const url = readFirstString(input, {}, ["url"]);
  if (!url) {
    throw new Error(`${operation} requires a URL.`);
  }

  const baseUrl = (readString(env?.TRELLIS_BROWSER_RUN_BASE_URL) ?? readString(env?.BROWSER_RUN_BASE_URL) ?? "https://browser.run").replace(/\/+$/, "");
  const response = await runtimeFetch(env, `${baseUrl}/${encodeURIComponent(action)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(readString(env?.TRELLIS_BROWSER_RUN_TOKEN)
        ? { authorization: `Bearer ${readString(env?.TRELLIS_BROWSER_RUN_TOKEN)}` }
        : {}),
    },
    body: JSON.stringify({
      ...input,
      profile: resolveBrowserRunProfile(provider, input),
    }),
  });
  if (!response.ok) {
    throw new Error(`${operation} failed with ${response.status}: ${await response.text()}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json") ? await response.json() : await response.text();
  return {
    provider: operation.startsWith("browser.") ? "browser" : "research",
    operation,
    url,
    action,
    result: raw,
  };
}

function resolveBrowserRunProfile(provider: TrellisProviderDefinition | undefined, input: Record<string, unknown>) {
  const profiles = provider?.config?.profiles;
  if (!isRecord(profiles)) {
    return undefined;
  }
  const allProfiles = isRecord(profiles.profiles) ? profiles.profiles : {};
  const profileName = readString(input.profile) ?? readString(profiles.defaultProfile);
  const profile = profileName ? allProfiles[profileName] : undefined;
  return isRecord(profile) ? profile : undefined;
}

function readFirecrawlSources(value: unknown): Array<"web" | "images" | "news"> {
  if (!Array.isArray(value)) {
    return ["web"];
  }
  const sources = value.filter((source): source is "web" | "images" | "news" =>
    source === "web" || source === "images" || source === "news"
  );
  return sources.length > 0 ? sources : ["web"];
}

function mapFirecrawlSearchResult(value: unknown, source: "web" | "images" | "news") {
  const result = isRecord(value) ? value : {};
  return {
    title: readString(result.title) ?? "Untitled",
    url: readString(result.url) ?? readString(result.imageUrl) ?? "",
    excerpt: readString(result.description) ?? readString(result.excerpt) ?? readString(result.snippet) ?? "",
    source,
  };
}

function runtimeFetch(env: Record<string, unknown> | undefined, input: Request | string | URL, init?: RequestInit) {
  const fetcher = typeof env?.TRELLIS_FETCH === "function"
    ? env.TRELLIS_FETCH as typeof fetch
    : fetch;
  return fetcher(input, init);
}

function readFirstString(
  primary: Record<string, unknown>,
  secondary: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const primaryValue = readString(primary[key]);
    if (primaryValue) {
      return primaryValue;
    }
    const secondaryValue = readString(secondary[key]);
    if (secondaryValue) {
      return secondaryValue;
    }
  }
  return undefined;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return undefined;
}

function parseRecordJson(value: unknown) {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function handleTraceEventsRequest(url: URL, env: Record<string, unknown> | undefined) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return jsonResponse({
      ok: false,
      error: "trace_store_unavailable",
      detail: "TRELLIS_DB is required before trace events can be read.",
    }, 501);
  }
  const traceId = readString(url.searchParams.get("traceId")) ?? readString(url.searchParams.get("trace_id"));
  if (!traceId) {
    return jsonResponse({
      ok: false,
      error: "trace_id_required",
      detail: "Pass traceId=<traceId>.",
    }, 400);
  }
  await ensureD1Schema(db);
  const limit = clampTraceLimit(readNumber(url.searchParams.get("limit")) ?? 100);
  const after = readString(url.searchParams.get("after"));
  const events = await readTraceEvents(db, traceId, { limit, after });
  return jsonResponse({
    ok: true,
    traceId,
    events,
  });
}

async function handleTraceEventStream(request: Request, url: URL, env: Record<string, unknown> | undefined) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return jsonResponse({
      ok: false,
      error: "trace_store_unavailable",
      detail: "TRELLIS_DB is required before trace events can be streamed.",
    }, 501);
  }
  const traceId = readString(url.searchParams.get("traceId")) ?? readString(url.searchParams.get("trace_id"));
  if (!traceId) {
    return jsonResponse({
      ok: false,
      error: "trace_id_required",
      detail: "Pass traceId=<traceId>.",
    }, 400);
  }

  await ensureD1Schema(db);
  const after = readString(url.searchParams.get("after")) ?? readString(request.headers.get("last-event-id"));
  const encoder = new TextEncoder();
  let closed = false;
  let lastEventId = after;
  const startedAt = Date.now();
  let lastHeartbeatAt = startedAt;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };
      const writeEvent = (event: TrellisTraceEventRecord) => {
        lastEventId = event.id;
        write(`event: ${event.type}\nid: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
        if (isTerminalTraceEvent(event)) {
          closed = true;
        }
      };

      while (!closed && Date.now() - startedAt < TRACE_STREAM_MAX_MS) {
        const events = await readTraceEvents(db, traceId, { limit: TRACE_STREAM_BATCH_LIMIT, after: lastEventId });
        for (const event of events) {
          writeEvent(event);
          if (closed) {
            break;
          }
        }
        if (closed) {
          break;
        }
        const now = Date.now();
        if (now - lastHeartbeatAt >= TRACE_STREAM_HEARTBEAT_MS) {
          write(": heartbeat\n\n");
          lastHeartbeatAt = now;
        }
        await sleep(TRACE_STREAM_POLL_MS);
      }
      closed = true;
      controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

const TRACE_STREAM_POLL_MS = 1_000;
const TRACE_STREAM_HEARTBEAT_MS = 15_000;
const TRACE_STREAM_MAX_MS = 300_000;
const TRACE_STREAM_BATCH_LIMIT = 500;

function clampTraceLimit(value: number) {
  return Math.max(1, Math.min(500, Math.floor(value)));
}

function isTerminalTraceEvent(event: TrellisTraceEventRecord) {
  return event.type === "run.completed" || event.type === "run.failed";
}

async function readTraceEvents(
  db: TrellisD1Database,
  traceId: string,
  options: { limit: number; after?: string },
) {
  const afterCursor = options.after
    ? await db.prepare(`
        SELECT created_at AS createdAt
        FROM trellis_trace_events
        WHERE trace_id = ? AND id = ?
      `).bind(traceId, options.after).first<{ createdAt?: string }>()
    : null;
  const afterCreatedAt = readString(afterCursor?.createdAt);
  const query = afterCreatedAt
    ? `
      SELECT
        id,
        trace_id AS traceId,
        signal_id AS signalId,
        workflow,
        span,
        type,
        message,
        payload_json AS payloadJson,
        created_at AS createdAt
      FROM trellis_trace_events
      WHERE trace_id = ?
        AND (created_at > ? OR (created_at = ? AND id > ?))
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    `
    : `
      SELECT
        id,
        trace_id AS traceId,
        signal_id AS signalId,
        workflow,
        span,
        type,
        message,
        payload_json AS payloadJson,
        created_at AS createdAt
      FROM trellis_trace_events
      WHERE trace_id = ?
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    `;
  const bindings = afterCreatedAt
    ? [traceId, afterCreatedAt, afterCreatedAt, options.after, options.limit]
    : [traceId, options.limit];
  const rows = await readD1Rows<{
    id: string;
    traceId: string;
    signalId?: string | null;
    workflow?: string | null;
    span: string;
    type: string;
    message: string;
    payloadJson?: string;
    createdAt?: string;
  }>(db, query, bindings);
  return rows
    .filter((row) => row.traceId === traceId)
    .sort((left, right) => {
      const byDate = String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""));
      return byDate || String(left.id).localeCompare(String(right.id));
    })
    .map((row): TrellisTraceEventRecord => ({
      id: String(row.id),
      traceId: String(row.traceId),
      signalId: readString(row.signalId) ?? null,
      workflow: readString(row.workflow) ?? null,
      span: String(row.span),
      type: String(row.type),
      message: String(row.message),
      payload: parseRecordJson(row.payloadJson),
      createdAt: readString(row.createdAt) ?? "",
    }));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleSlackWebhook(
  request: Request,
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
) {
  const botResult = await getTrellisSlackBot(env, config);
  if (!botResult.ok) {
    const eventSink = createTrellisEventSink(env);
    await emitTrellisTrace(eventSink, {
      id: `trace_event_slack_webhook_unavailable_${stableHashPart(String(Date.now()))}`,
      traceId: "trace_slack_webhook",
      workflow: "slack",
      span: "slack",
      type: "slack.webhook.unavailable",
      message: "Slack webhook received but ChatSDK Slack is not available.",
      payload: {
        error: botResult.error,
      },
    });
    return jsonResponse({
      ok: false,
      error: botResult.error,
      detail: botResult.detail,
    }, botResult.status);
  }
  return botResult.bot.webhooks.slack(request, {
    waitUntil(promise: Promise<unknown>) {
      promise.catch(() => undefined);
    },
  });
}

async function getTrellisSlackBot(env: Record<string, unknown> | undefined, config: TrellisAgentConfig) {
  const factory = env?.TRELLIS_SLACK_BOT_FACTORY;
  if (typeof factory === "function") {
    const bot = await Promise.resolve((factory as (input: Record<string, unknown>) => unknown)({
      env,
      config,
      handlers: {
        handleSlashCommand: (event: unknown) => handleTrellisSlashCommand(event, env),
        handleAction: (event: unknown) => handleTrellisSlackAction(event, env, config),
      },
    }));
    return isSlackBotLike(bot)
      ? { ok: true as const, bot }
      : {
          ok: false as const,
          status: 500,
          error: "invalid_slack_bot_factory",
          detail: "TRELLIS_SLACK_BOT_FACTORY did not return a ChatSDK-compatible bot.",
        };
  }

  const botToken = readString(env?.SLACK_BOT_TOKEN);
  const signingSecret = readString(env?.SLACK_SIGNING_SECRET);
  if (!botToken || !signingSecret) {
    return {
      ok: false as const,
      status: 501,
      error: "slack_not_configured",
      detail: "SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET are required for /webhooks/slack.",
    };
  }

  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
    const chatModule = await dynamicImport("chat");
    const slackModule = await dynamicImport("@chat-adapter/slack");
    const Chat = chatModule.Chat as new (config: Record<string, unknown>) => Record<string, unknown>;
    const createSlackAdapter = slackModule.createSlackAdapter as (config?: Record<string, unknown>) => unknown;
    const bot = new Chat({
      userName: readString(env?.TRELLIS_SLACK_BOT_NAME) ?? "trellis",
      adapters: {
        slack: createSlackAdapter({
          botToken,
          signingSecret,
        }),
      },
      streamingUpdateIntervalMs: 1_000,
      fallbackStreamingPlaceholderText: "Watching Trellis...",
      logger: "warn",
    });
    registerTrellisSlackHandlers(bot, env, config);
    return isSlackBotLike(bot)
      ? { ok: true as const, bot }
      : {
          ok: false as const,
          status: 500,
          error: "invalid_chat_sdk_bot",
          detail: "ChatSDK did not expose a Slack webhook handler.",
        };
  } catch (error) {
    return {
      ok: false as const,
      status: 501,
      error: "chat_sdk_unavailable",
      detail: sanitizeRuntimeError(error),
    };
  }
}

function registerTrellisSlackHandlers(
  bot: Record<string, unknown>,
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
) {
  if (typeof bot.onSlashCommand === "function") {
    (bot.onSlashCommand as (command: string, handler: (event: unknown) => Promise<void>) => void)("/trellis", async (event) => {
      await handleTrellisSlashCommand(event, env);
    });
  }
  if (typeof bot.onAction === "function") {
    (bot.onAction as (actions: string[], handler: (event: unknown) => Promise<void>) => void)(["approve", "reject"], async (event) => {
      await handleTrellisSlackAction(event, env, config);
    });
  }
}

function isSlackBotLike(value: unknown): value is { webhooks: { slack(request: Request, context?: unknown): Promise<Response> | Response } } {
  return isRecord(value)
    && isRecord(value.webhooks)
    && typeof value.webhooks.slack === "function";
}

async function handleTrellisSlashCommand(event: unknown, env: Record<string, unknown> | undefined) {
  const record = isRecord(event) ? event : {};
  const channel = isRecord(record.channel) ? record.channel : {};
  const text = readString(record.text) ?? "";
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const command = parts[0]?.toLowerCase() ?? "help";
  const post = async (message: unknown) => {
    if (typeof channel.post === "function") {
      await Promise.resolve((channel.post as (message: unknown) => unknown)(message));
    }
  };

  if (command === "status") {
    const lookup = parts[1];
    await post(await renderSlackStatus(env, lookup));
    return;
  }
  if (command === "watch") {
    const traceId = parts[1];
    if (!traceId) {
      await post("Usage: `/trellis watch <traceId>`");
      return;
    }
    await post(slackTraceWatchStream(env, traceId));
    return;
  }
  if ((command === "pause" || command === "resume") && parts[1] === "thread" && parts[2]) {
    const status = command === "pause" ? "paused" : "active";
    const result = await recordOperatorControl(env, {
      scope: "thread",
      targetId: parts[2],
      status,
      actor: readSlackUserName(record.user),
      reason: "Slack /trellis command",
      traceId: `trace_slack_${normalizeIdPart(parts[2])}`,
    });
    await post(`${command === "pause" ? "Paused" : "Resumed"} Trellis thread ${parts[2]}. ${result.persistence.enabled ? "" : "State persistence is not configured."}`.trim());
    return;
  }

  await post("Usage: `/trellis status <traceId|signalId|threadId>`, `/trellis watch <traceId>`, `/trellis pause thread <threadId>`, `/trellis resume thread <threadId>`");
}

async function handleTrellisSlackAction(
  event: unknown,
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
) {
  const record = isRecord(event) ? event : {};
  const actionId = readString(record.actionId);
  if (actionId !== "approve" && actionId !== "reject") {
    return;
  }
  const input = await resolveSlackApprovalInput(env, record);
  const status: TrellisApprovalDecisionStatus = actionId === "approve" ? "approved" : "rejected";
  const decision = await recordApprovalDecision(env, {
    approvalId: input.approvalId,
    traceId: input.traceId,
    signalId: input.signalId,
    status,
    action: input.action,
    draftId: input.draftId,
    actor: readSlackUserName(record.user),
    reason: "Slack action",
  }, config);
  const thread = isRecord(record.thread) ? record.thread : null;
  if (thread && typeof thread.post === "function") {
    await Promise.resolve((thread.post as (message: unknown) => unknown)(`Approval ${input.approvalId} ${status}.`));
  }
  return decision;
}

async function resolveSlackApprovalInput(env: Record<string, unknown> | undefined, event: Record<string, unknown>) {
  const parsed = parseSlackActionValue(readString(event.value));
  const approvalId = readString(parsed.approvalId) ?? readString(event.approvalId);
  if (!approvalId) {
    throw new Error("Slack approval action is missing approvalId.");
  }
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  const stored = db?.prepare ? await readApprovalRecord(db, approvalId) : null;
  return {
    approvalId,
    traceId: readString(parsed.traceId) ?? readString(stored?.traceId) ?? traceIdForSignalId(readString(parsed.signalId) ?? readString(stored?.signalId) ?? `approval:${approvalId}`),
    signalId: readString(parsed.signalId) ?? readString(stored?.signalId) ?? `approval:${approvalId}`,
    action: readString(parsed.action) ?? readString(stored?.action) ?? inferApprovalAction(approvalId),
    draftId: readString(parsed.draftId) ?? readString(stored?.draftId) ?? inferApprovalDraftId(approvalId),
  };
}

function parseSlackActionValue(value: string | undefined) {
  if (!value) {
    return {};
  }
  const parsed = parseJsonText(value);
  return isRecord(parsed) ? parsed : { approvalId: value };
}

function readSlackUserName(value: unknown) {
  const user = isRecord(value) ? value : {};
  return readString(user.fullName) ?? readString(user.userName) ?? readString(user.name) ?? readString(user.id) ?? "slack";
}

async function readApprovalRecord(db: TrellisD1Database, approvalId: string) {
  await ensureD1Schema(db);
  return await db.prepare(`
    SELECT
      id,
      draft_id AS draftId,
      signal_id AS signalId,
      action,
      status,
      updated_at AS updatedAt
    FROM trellis_approvals
    WHERE id = ?
  `).bind(approvalId).first<Record<string, unknown>>();
}

async function renderSlackStatus(env: Record<string, unknown> | undefined, lookup: string | undefined) {
  if (!lookup) {
    return "Usage: `/trellis status <traceId|signalId|threadId>`";
  }
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return "Trellis state is not configured yet.";
  }
  await ensureD1Schema(db);
  const traceId = await resolveTraceIdLookup(db, lookup);
  if (!traceId) {
    return `No Trellis trace found for ${lookup}.`;
  }
  const events = await readTraceEvents(db, traceId, { limit: 25 });
  const latest = events[events.length - 1];
  return [
    `Trellis trace ${traceId}`,
    `Latest: ${latest?.type ?? "none"}`,
    latest?.message ? `Message: ${latest.message}` : null,
    `Events: ${events.length}`,
  ].filter(Boolean).join("\n");
}

async function resolveTraceIdLookup(db: TrellisD1Database, lookup: string) {
  if (lookup.startsWith("trace_")) {
    return lookup;
  }
  const signal = await db.prepare(`
    SELECT
      id,
      payload_json AS payloadJson
    FROM trellis_signals
    WHERE id = ? OR thread_id = ?
  `).bind(lookup, lookup).first<{ id: string; payloadJson?: string }>();
  const payload = parseRecordJson(signal?.payloadJson);
  return readString(payload.traceId) ?? (signal?.id ? traceIdForSignalId(signal.id) : undefined);
}

async function* slackTraceWatchStream(env: Record<string, unknown> | undefined, traceId: string) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    yield "Trellis state is not configured yet.";
    return;
  }
  let after: string | undefined;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 300_000) {
    const events = await readTraceEvents(db, traceId, { limit: TRACE_STREAM_BATCH_LIMIT, after });
    for (const event of events) {
      after = event.id;
      yield `${event.type}: ${event.message}\n`;
      if (isTerminalTraceEvent(event)) {
        return;
      }
    }
    await sleep(TRACE_STREAM_POLL_MS);
  }
}

async function notifySlackForTraceEvent(
  env: Record<string, unknown> | undefined,
  event: TrellisTraceEventRecord,
) {
  if (!shouldNotifySlackEvent(event) || !readString(env?.SLACK_BOT_TOKEN) || !readString(env?.SLACK_DEFAULT_CHANNEL)) {
    return;
  }
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return;
  }
  await ensureD1Schema(db);
  const thread = event.type === "signal.accepted"
    ? await ensureSlackThread(env, db, event)
    : await readSlackThread(db, event.traceId);
  if (!thread) {
    return;
  }
  if (event.type === "signal.accepted") {
    return;
  }
  await postSlackMessage(env, {
    channel: thread.slackChannelId,
    thread_ts: thread.slackThreadTs,
    text: slackTextForTraceEvent(event),
    blocks: slackBlocksForTraceEvent(event),
  });
}

function shouldNotifySlackEvent(event: TrellisTraceEventRecord) {
  return [
    "signal.accepted",
    "skill.completed",
    "skill.failed",
    "skill.fallback",
    "workflow.started",
    "draft.created",
    "approval.waiting",
    "approval.approved",
    "approval.rejected",
    "provider_action.queued",
    "provider_action.completed",
    "provider_action.failed",
    "run.completed",
    "run.failed",
  ].includes(event.type);
}

async function ensureSlackThread(
  env: Record<string, unknown> | undefined,
  db: TrellisD1Database,
  event: TrellisTraceEventRecord,
) {
  const existing = await readSlackThread(db, event.traceId);
  if (existing) {
    return existing;
  }
  const channel = readString(env?.SLACK_DEFAULT_CHANNEL);
  if (!channel) {
    return null;
  }
  const posted = await postSlackMessage(env, {
    channel,
    text: slackTextForTraceEvent(event),
  });
  const threadTs = readString(posted.ts);
  if (!threadTs) {
    throw new Error("Slack did not return message timestamp.");
  }
  const now = new Date().toISOString();
  await runD1(db, `
    INSERT OR REPLACE INTO trellis_slack_threads
      (trace_id, signal_id, trellis_thread_id, slack_channel_id, slack_thread_ts, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    event.traceId,
    event.signalId,
    readString(event.payload.threadId),
    channel,
    threadTs,
    now,
  ]);
  return {
    traceId: event.traceId,
    signalId: event.signalId,
    trellisThreadId: readString(event.payload.threadId) ?? null,
    slackChannelId: channel,
    slackThreadTs: threadTs,
    updatedAt: now,
  };
}

async function readSlackThread(db: TrellisD1Database, traceId: string) {
  const row = await db.prepare(`
    SELECT
      trace_id AS traceId,
      signal_id AS signalId,
      trellis_thread_id AS trellisThreadId,
      slack_channel_id AS slackChannelId,
      slack_thread_ts AS slackThreadTs,
      updated_at AS updatedAt
    FROM trellis_slack_threads
    WHERE trace_id = ?
  `).bind(traceId).first<{
    traceId: string;
    signalId?: string | null;
    trellisThreadId?: string | null;
    slackChannelId: string;
    slackThreadTs: string;
    updatedAt?: string | null;
  }>();
  return row ?? null;
}

async function postSlackMessage(env: Record<string, unknown> | undefined, body: Record<string, unknown>) {
  const token = readString(env?.SLACK_BOT_TOKEN);
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is required.");
  }
  const response = await runtimeFetch(env, slackApiMethodUrl(env, "chat.postMessage"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !isRecord(json) || json.ok !== true) {
    throw new Error(`Slack post failed with ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function slackApiMethodUrl(env: Record<string, unknown> | undefined, method: string) {
  const configured = readString(env?.SLACK_API_URL);
  if (!configured) {
    return `https://slack.com/api/${method}`;
  }
  return configured.endsWith(`/${method}`)
    ? configured
    : `${configured.replace(/\/+$/, "")}/${method}`;
}

function slackTextForTraceEvent(event: TrellisTraceEventRecord) {
  return `[${event.type}] ${event.message}`;
}

function slackBlocksForTraceEvent(event: TrellisTraceEventRecord) {
  if (event.type !== "approval.waiting") {
    return undefined;
  }
  const approvalId = readString(event.payload.approvalId);
  if (!approvalId) {
    return undefined;
  }
  const value = JSON.stringify({
    approvalId,
    traceId: event.traceId,
    signalId: event.signalId,
    action: readString(event.payload.action),
    draftId: readString(event.payload.draftId),
  });
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Approval waiting*\n${event.message}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          style: "primary",
          action_id: "approve",
          value,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Reject" },
          style: "danger",
          action_id: "reject",
          value,
        },
      ],
    },
  ];
}

async function readRuntimeSnapshot(env: Record<string, unknown> | undefined) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  const packs = await readPackContext(env);
  if (!db?.prepare) {
    return {
      enabled: false,
      counts: null,
      recent: null,
      packs,
      controls: await readOperatorControls(env),
      traceExport: summarizeTraceExport(env),
      events: summarizeEventStreaming(env),
      slack: summarizeSlackOperator(env),
    };
  }

  return {
    enabled: true,
    counts: {
      signals: await countD1Rows(db, "trellis_signals"),
      prospects: await countD1Rows(db, "trellis_prospects"),
      stateRecords: await countD1Rows(db, "trellis_state_records"),
      drafts: await countD1Rows(db, "trellis_drafts"),
      approvals: await countD1Rows(db, "trellis_approvals"),
      providerRuns: await countD1Rows(db, "trellis_provider_runs"),
      providerActions: await countD1Rows(db, "trellis_provider_actions"),
      workflowRuns: await countD1Rows(db, "trellis_workflow_runs"),
      operatorControls: await countD1Rows(db, "trellis_operator_controls"),
      smokeRuns: await countD1Rows(db, "trellis_smoke_runs"),
      traceEvents: await countD1Rows(db, "trellis_trace_events"),
      auditEvents: await countD1Rows(db, "trellis_audit_events"),
    },
    recent: await readRecentRuntimeRows(db),
    packs,
    controls: await readOperatorControls(env),
    traceExport: summarizeTraceExport(env),
    events: summarizeEventStreaming(env),
    slack: summarizeSlackOperator(env),
  };
}

async function readRecentRuntimeRows(db: TrellisD1Database) {
  return {
    signals: (await readD1Rows<{
      id: string;
      workspaceId: string;
      threadId: string;
      campaignId?: string | null;
      provider?: string | null;
      source?: string | null;
      payloadJson?: string;
      createdAt?: string;
    }>(db, `
      SELECT
        id,
        workspace_id AS workspaceId,
        thread_id AS threadId,
        campaign_id AS campaignId,
        provider,
        source,
        payload_json AS payloadJson,
        created_at AS createdAt
      FROM trellis_signals
      ORDER BY created_at DESC
      LIMIT ?
    `, [5])).map((row) => ({
      ...row,
      payload: parseJsonValue(row.payloadJson),
      payloadJson: undefined,
    })),
    prospects: await readD1Rows(db, `
      SELECT
        id,
        signal_id AS signalId,
        workspace_id AS workspaceId,
        thread_id AS threadId,
        status,
        updated_at AS updatedAt
      FROM trellis_prospects
      ORDER BY updated_at DESC
      LIMIT ?
    `, [5]),
    stateRecords: (await readD1Rows<{
      id: string;
      entity: string;
      recordId: string;
      signalId: string;
      workspaceId: string;
      threadId: string;
      fieldsJson?: string;
      schemaJson?: string;
      indexesJson?: string;
      relationshipsJson?: string;
      updatedAt?: string;
    }>(db, `
      SELECT
        id,
        entity,
        record_id AS recordId,
        signal_id AS signalId,
        workspace_id AS workspaceId,
        thread_id AS threadId,
        fields_json AS fieldsJson,
        schema_json AS schemaJson,
        indexes_json AS indexesJson,
        relationships_json AS relationshipsJson,
        updated_at AS updatedAt
      FROM trellis_state_records
      ORDER BY updated_at DESC
      LIMIT ?
    `, [5])).map((row) => ({
      ...row,
      fields: parseJsonValue(row.fieldsJson),
      schema: parseJsonValue(row.schemaJson),
      indexes: parseJsonValue(row.indexesJson),
      relationships: parseJsonValue(row.relationshipsJson),
      fieldsJson: undefined,
      schemaJson: undefined,
      indexesJson: undefined,
      relationshipsJson: undefined,
    })),
    drafts: (await readD1Rows<{
      id: string;
      signalId: string;
      channel: string;
      status: string;
      approvalRequiredJson?: string;
      body: string;
      updatedAt?: string;
    }>(db, `
      SELECT
        id,
        signal_id AS signalId,
        channel,
        status,
        approval_required_json AS approvalRequiredJson,
        body,
        updated_at AS updatedAt
      FROM trellis_drafts
      ORDER BY updated_at DESC
      LIMIT ?
    `, [5])).map((row) => ({
      ...row,
      approvalRequiredFor: parseJsonValue(row.approvalRequiredJson),
      approvalRequiredJson: undefined,
    })),
    approvals: await readD1Rows(db, `
      SELECT
        id,
        draft_id AS draftId,
        signal_id AS signalId,
        action,
        status,
        updated_at AS updatedAt
      FROM trellis_approvals
      ORDER BY updated_at DESC
      LIMIT ?
    `, [10]),
    providerActions: await readD1Rows(db, `
      SELECT
        id,
        approval_id AS approvalId,
        signal_id AS signalId,
        draft_id AS draftId,
        provider,
        operation,
        status,
        trace_id AS traceId,
        updated_at AS updatedAt
      FROM trellis_provider_actions
      ORDER BY updated_at DESC
      LIMIT ?
    `, [10]),
    providerRuns: (await readD1Rows<{
      id: string;
      provider: string;
      kind: string;
      externalId?: string | null;
      status: string;
      requestJson?: string;
      responseJson?: string;
      error?: string | null;
      createdAt?: string;
      updatedAt?: string;
    }>(db, `
      SELECT
        id,
        provider,
        kind,
        external_id AS externalId,
        status,
        request_json AS requestJson,
        response_json AS responseJson,
        error,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM trellis_provider_runs
      ORDER BY updated_at DESC
      LIMIT ?
    `, [10])).map((row) => ({
      ...row,
      request: parseJsonValue(row.requestJson),
      response: parseJsonValue(row.responseJson),
      requestJson: undefined,
      responseJson: undefined,
    })),
    workflowRuns: (await readD1Rows<{
      id: string;
      signalId: string;
      workflow: string;
      status: string;
      paramsJson?: string;
      updatedAt?: string;
    }>(db, `
      SELECT
        id,
        signal_id AS signalId,
        workflow,
        status,
        params_json AS paramsJson,
        updated_at AS updatedAt
      FROM trellis_workflow_runs
      ORDER BY updated_at DESC
      LIMIT ?
    `, [10])).map((row) => ({
      ...row,
      params: parseJsonValue(row.paramsJson),
      paramsJson: undefined,
    })),
    auditEvents: await readD1Rows(db, `
      SELECT
        id,
        signal_id AS signalId,
        workflow,
        type,
        message,
        created_at AS createdAt
      FROM trellis_audit_events
      ORDER BY created_at DESC
      LIMIT ?
    `, [20]),
    traceEvents: (await readD1Rows<{
      id: string;
      traceId: string;
      signalId?: string | null;
      workflow?: string | null;
      span: string;
      type: string;
      message: string;
      payloadJson?: string;
      createdAt?: string;
    }>(db, `
      SELECT
        id,
        trace_id AS traceId,
        signal_id AS signalId,
        workflow,
        span,
        type,
        message,
        payload_json AS payloadJson,
        created_at AS createdAt
      FROM trellis_trace_events
      ORDER BY created_at DESC
      LIMIT ?
    `, [20])).map((row) => ({
      ...row,
      payload: parseJsonValue(row.payloadJson),
      payloadJson: undefined,
    })),
    smokeRuns: (await readD1Rows<{
      id: string;
      agent: string;
      status: string;
      fixtureId: string;
      traceId: string;
      checksJson?: string;
      resultJson?: string;
      createdAt?: string;
    }>(db, `
      SELECT
        id,
        agent,
        status,
        fixture_id AS fixtureId,
        trace_id AS traceId,
        checks_json AS checksJson,
        result_json AS resultJson,
        created_at AS createdAt
      FROM trellis_smoke_runs
      ORDER BY created_at DESC
      LIMIT ?
    `, [5])).map((row) => ({
      ...row,
      checks: parseJsonValue(row.checksJson),
      result: parseJsonValue(row.resultJson),
      checksJson: undefined,
      resultJson: undefined,
    })),
  };
}

async function readD1Rows<T = Record<string, unknown>>(
  db: TrellisD1Database,
  sql: string,
  bindings: unknown[] = [],
): Promise<T[]> {
  try {
    const statement = db.prepare(sql).bind(...bindings);
    if (typeof statement.all !== "function") {
      return [];
    }
    const result = await statement.all<T>();
    return Array.isArray(result.results) ? result.results : [];
  } catch {
    return [];
  }
}

async function countD1Rows(db: TrellisD1Database, tableName: string) {
  try {
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).bind().first<{ count: number }>();
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value ?? null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function readPackContext(env: Record<string, unknown> | undefined) {
  const bucket = env?.TRELLIS_PACKS as TrellisR2Bucket | undefined;
  if (!bucket?.get) {
    return {
      enabled: false,
      knowledge: null,
      skills: null,
    };
  }

  const manifestObject = await bucket.get("knowledge/manifest.json");
  const manifestText = manifestObject ? await manifestObject.text() : undefined;
  const manifest = parseKnowledgeManifest(manifestText);
  const listed = bucket.list ? await bucket.list({ prefix: "" }) : null;
  const objects = listed?.objects ?? [];
  const knowledgeObjects = objects.filter((object) => object.key.startsWith("knowledge/files/"));
  const skillObjects = objects.filter((object) => object.key.startsWith("skills/files/"));
  const [knowledgeFiles, skillFiles] = await Promise.all([
    hydratePackFiles(bucket, knowledgeObjects, "knowledge/files/"),
    hydratePackFiles(bucket, skillObjects, "skills/files/"),
  ]);

  return {
    enabled: true,
    knowledge: {
      manifest: manifest
        ? {
            source: typeof manifest.source === "string" ? manifest.source : null,
            files: Array.isArray(manifest.files) ? manifest.files.length : 0,
          }
        : null,
      objects: knowledgeObjects.length,
      files: knowledgeFiles,
    },
    skills: {
      objects: skillObjects.length,
      files: skillFiles,
    },
  };
}

async function hydratePackFiles(
  bucket: TrellisR2Bucket,
  objects: Array<{ key: string; size?: number }>,
  prefix: string,
) {
  const files = [];
  for (const object of objects
    .slice()
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(0, MAX_PACK_CONTEXT_FILES)) {
    const stored = await bucket.get(object.key);
    const text = stored ? String(await stored.text()) : "";
    files.push({
      key: object.key,
      path: object.key.slice(prefix.length),
      bytes: object.size ?? text.length,
      text: text.slice(0, MAX_PACK_CONTEXT_FILE_CHARS),
      truncated: text.length > MAX_PACK_CONTEXT_FILE_CHARS,
    });
  }
  return files;
}

function parseKnowledgeManifest(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as {
      source?: unknown;
      files?: unknown;
    };
    return parsed;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function traceIdForSignal(signal: Pick<TrellisSignal, "id" | "traceId" | "payload">) {
  return readString(signal.traceId)
    ?? readString(signal.payload?.traceId)
    ?? readString(signal.payload?.trace_id)
    ?? traceIdForSignalId(signal.id);
}

function traceIdForSignalId(signalId: string) {
  return `trace_${normalizeIdPart(signalId)}`;
}

function traceSpanForAuditEvent(event: TrellisAuditEvent) {
  const skill = readString(event.metadata?.skill);
  if (skill) {
    return `skill:${skill}`;
  }
  if (event.workflow) {
    return `workflow:${event.workflow}`;
  }
  return event.type.split(".")[0] ?? "runtime";
}

function normalizeIdPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "idempotent";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function renderDashboard(
  agent: TrellisAgentDefinition<TrellisGtmApp>,
  snapshot: Awaited<ReturnType<typeof readRuntimeSnapshot>>,
) {
  const counts = snapshot.counts ?? {
    signals: 0,
    prospects: 0,
    stateRecords: 0,
    drafts: 0,
    approvals: 0,
    providerRuns: 0,
    providerActions: 0,
    workflowRuns: 0,
    operatorControls: 0,
    smokeRuns: 0,
    traceEvents: 0,
    auditEvents: 0,
  };
  const packs = snapshot.packs;
  const controls = snapshot.controls;
  const traceExport = snapshot.traceExport;
  const recent = snapshot.recent;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Trellis</title>
  </head>
  <body>
    <main>
      <h1>Trellis ${agent.name}</h1>
      <p>Trellis GTM runtime</p>
      <p>No-send mode: ${agent.config.safety?.noSends ?? true}</p>
      <dl>
        <dt>Signals</dt><dd>${counts.signals}</dd>
        <dt>Prospects</dt><dd>${counts.prospects}</dd>
        <dt>State Records</dt><dd>${counts.stateRecords}</dd>
        <dt>Drafts</dt><dd>${counts.drafts}</dd>
        <dt>Approvals</dt><dd>${counts.approvals}</dd>
        <dt>Provider Runs</dt><dd>${counts.providerRuns}</dd>
        <dt>Provider Actions</dt><dd>${counts.providerActions}</dd>
        <dt>Workflow Runs</dt><dd>${counts.workflowRuns}</dd>
        <dt>Operator Controls</dt><dd>${counts.operatorControls}</dd>
        <dt>Smoke Runs</dt><dd>${counts.smokeRuns}</dd>
        <dt>Kill Switch</dt><dd>${controls.globalKillSwitch?.status === "enabled" ? "enabled" : "disabled"}</dd>
        <dt>Active Control Blocks</dt><dd>${controls.reasons.join("; ") || "none"}</dd>
        <dt>Trace Events</dt><dd>${counts.traceEvents}</dd>
        <dt>Trace Export</dt><dd>${traceExport.enabled ? "enabled" : "disabled"}</dd>
        <dt>Audit Events</dt><dd>${counts.auditEvents}</dd>
        <dt>Knowledge Files</dt><dd>${packs.knowledge?.manifest?.files ?? 0}</dd>
        <dt>Skill Files</dt><dd>${packs.skills?.objects ?? 0}</dd>
      </dl>
      <section>
        <h2>Recent Provider Runs</h2>
        ${renderRecentRows(recent?.providerRuns, (row) => `${readString(row.provider) ?? "provider"}:${readString(row.status) ?? "unknown"} ${readString(row.id) ?? ""}`)}
      </section>
      <section>
        <h2>Recent Workflow Runs</h2>
        ${renderRecentRows(recent?.workflowRuns, (row) => `${readString(row.workflow) ?? "workflow"}:${readString(row.status) ?? "unknown"} ${readString(row.id) ?? ""}`)}
      </section>
      <section>
        <h2>Recent Provider Actions</h2>
        ${renderRecentRows(recent?.providerActions, (row) => `${readString(row.provider) ?? "provider"}:${readString(row.operation) ?? "operation"} ${readString(row.status) ?? "unknown"}`)}
      </section>
      <section>
        <h2>Recent Audit Events</h2>
        ${renderRecentRows(recent?.auditEvents, (row) => `${readString(row.type) ?? "audit"} ${readString(row.message) ?? ""}`)}
      </section>
      <section>
        <h2>Recent Trace Events</h2>
        ${renderRecentRows(recent?.traceEvents, (row) => `${readString(row.span) ?? "trace"}:${readString(row.type) ?? "event"}`)}
      </section>
    </main>
  </body>
</html>`;
}

function renderRecentRows(
  rows: unknown,
  label: (row: Record<string, unknown>) => string,
) {
  const records = Array.isArray(rows) ? rows.filter(isRecord).slice(0, 5) : [];
  if (records.length === 0) {
    return "<p>none</p>";
  }
  return `<ol>${records.map((row) => `<li>${escapeHtml(label(row))}</li>`).join("")}</ol>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
