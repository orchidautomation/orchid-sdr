import { z } from "zod";

export type TrellisProviderKind =
  | "source"
  | "crm"
  | "email"
  | "enrichment"
  | "research"
  | "observability"
  | "handoff";

export interface TrellisProviderDefinition {
  id: string;
  kind: TrellisProviderKind;
  displayName: string;
  env?: Array<{
    name: string;
    required?: boolean;
    description?: string;
  }>;
  capabilities?: string[];
}

export interface TrellisSafetyPolicy {
  noSends: boolean;
  requireApproval: string[];
  killSwitch: boolean;
}

export interface TrellisAgentConfig {
  crm?: TrellisProviderDefinition;
  email?: TrellisProviderDefinition;
  research?: TrellisProviderDefinition;
  observability?: TrellisProviderDefinition;
  handoff?: TrellisProviderDefinition;
  model?: string;
  knowledge: string | string[];
  skills: string | string[];
  safety?: TrellisSafetyPolicy;
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

export interface TrellisFlueContextFactoryInput {
  env?: Record<string, unknown>;
  config: TrellisAgentConfig;
  signal: Partial<TrellisSignal>;
  packs: unknown;
  tools: TrellisMcpToolDefinition[];
}

export interface TrellisMcpToolDefinition {
  name: string;
  description: string;
  provider?: string;
  operation?: string;
  inputSchema?: Record<string, unknown>;
  execute?(input: Record<string, unknown>): Promise<unknown> | unknown;
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

interface TrellisWorkflowRunRecord {
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
  input: Record<string, unknown>;
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
      requireApproval: input?.requireApproval ?? ["email.send", "mail.reply", "crm.update", "handoff.webhook"],
      killSwitch: input?.killSwitch ?? true,
    };
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
    signal() {
      auditEvents.push({
        id: nextAuditEventId(signal, auditEvents),
        traceId: signal.traceId,
        type: "signal.accepted",
        message: "Accepted fixture signal.",
        signalId: signal.id,
        metadata: {
          provider: signal.provider,
          source: signal.source,
        },
      });
      return signal;
    },
    context(currentSignal) {
      return {
        signal: currentSignal,
        ...(input?.context ?? {}),
      };
    },
    async skill(name, skillInput) {
      skillCalls.push({
        name,
        context: skillInput.context,
      });
      if (input?.harness) {
        const harnessResult = await input.harness.skill(name, skillInput);
        const parsed = parseSkillOutput(harnessResult, skillInput.schema);
        auditEvents.push({
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
        });
        return parsed;
      }

      const result = input?.skillResults?.[name] ?? {
        ...defaultSkillResult(name),
      };
      const parsed = parseSkillOutput(result, skillInput.schema);
      auditEvents.push({
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
      });
      return parsed;
    },
    workflow(name) {
      return {
        start(workflowInput) {
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
          auditEvents.push({
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
          });
          auditEvents.push({
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
          });
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
      "loaded Trellis v3 agent manifest with knowledge and skills",
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
        && ["email.send", "crm.update"].every((approval) =>
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

export async function runTrellisAgent(
  agent: TrellisAgentDefinition<TrellisGtmApp>,
  input?: {
    signal?: Partial<TrellisSignal>;
    context?: Record<string, unknown>;
    skillResults?: Record<string, unknown>;
    harness?: TrellisHarnessRuntime;
  },
): Promise<TrellisRuntimeResult> {
  const app = createTrellisTestApp(input);
  const result = await agent.handler(app);
  const approvals = createApprovalsForDrafts(app.fixtureSignal, app.drafts);
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
  if (name !== "reply") {
    return ["email.send", "crm.update"];
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
    return "email.send";
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

        if (url.pathname === "/healthz") {
          return jsonResponse({
            ok: true,
            agent: agent.name,
            stack: "trellis-v3-cloudflare",
            safety: agent.config.safety ?? trellis.safeOutbound(),
            bindings: summarizeCloudflareBindings(env),
            traceExport: summarizeTraceExport(env),
          });
        }

        if (url.pathname === "/smoke") {
          const smoke = await runTrellisSmoke({ agent });
          return jsonResponse({
            ...smoke,
            history: await recordSmokeRun(env, smoke),
          });
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
          const harness = await createRuntimeHarness(env, agent.config, {
            signal,
            packs: packContext,
          });
          const run = await runTrellisAgent(agent, {
            signal,
            context: {
              packs: packContext,
              inboundReply: agentMail,
            },
            harness,
          });
          const persistence = await persistRuntimeResult(env, run);
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
          return jsonResponse({
            ok: true,
            server: "trellis",
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
            "/webhooks/signals",
            "/webhooks/apify",
            "/webhooks/agentmail",
            "/approvals/:id/approve",
            "/approvals/:id/reject",
            "/provider-actions",
            "/provider-actions/:id/execute",
            "/provider-actions/:id/complete",
            "/provider-actions/:id/fail",
            "/operator/controls",
            "/operator/kill-switch/:enable|disable",
            "/operator/campaigns/:id/:pause|resume",
            "/operator/threads/:id/:pause|resume",
            "/operator/workflows/:id/replay",
            "/operator/provider-actions/:id/replay",
            "/mcp/trellis",
            "/dashboard",
          ],
        });
      },
      async queue(batch: TrellisQueueBatch, env?: Record<string, unknown>) {
        return drainTrellisQueue(batch, env, agent.config);
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
  const tools: TrellisMcpToolDefinition[] = [
    {
      name: "trellis.health",
      description: "Inspect the Trellis runtime, configured providers, safety policy, and Cloudflare bindings.",
      operation: "trellis.health",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute() {
        return {
          ok: true,
          stack: "trellis-v3-cloudflare",
          providers: {
            crm: config.crm?.id ?? null,
            email: config.email?.id ?? null,
            research: config.research?.id ?? null,
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
      description: "Inspect durable Trellis smoke run history recorded in D1.",
      operation: "trellis.smoke.history",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "trellis.signal.inspect",
      description: "Inspect recent accepted GTM signals from the D1 runtime projection.",
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
      description: "Inspect the mounted R2-backed knowledge and skill pack metadata available to Trellis skills.",
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
      description: "Inspect optional trace export sinks. D1 trellis_trace_events remains canonical.",
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
      description: "Replay a stored workflow run through the configured Cloudflare Workflow binding.",
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

  if (config.research?.id === "firecrawl") {
    tools.push(
      {
        name: "research.search",
        description: "Search the web or news with Firecrawl and return normalized research snippets.",
        provider: "firecrawl",
        operation: "research.search",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 10 },
            sources: {
              type: "array",
              items: { type: "string", enum: ["web", "news"] },
            },
            tbs: { type: "string" },
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
    );
  }

  return tools;
}

async function createRuntimeHarness(
  env: Record<string, unknown> | undefined,
  config: TrellisAgentConfig,
  runtime: {
    signal: Partial<TrellisSignal>;
    packs: unknown;
  },
): Promise<TrellisHarnessRuntime | undefined> {
  const explicitHarness = env?.TRELLIS_HARNESS;
  if (isHarnessRuntime(explicitHarness)) {
    return explicitHarness;
  }

  const factory = env?.TRELLIS_FLUE_CONTEXT_FACTORY;
  if (typeof factory === "function") {
    const tools = createTrellisMcpTools(env, config);
    const created = await Promise.resolve((factory as (
      input: TrellisFlueContextFactoryInput,
    ) => unknown | Promise<unknown>)({
      env,
      config,
      signal: runtime.signal,
      packs: runtime.packs,
      tools,
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
  },
  tools?: TrellisMcpToolDefinition[],
): TrellisHarnessRuntime {
  let harnessPromise: Promise<FlueHarnessLike> | undefined;
  async function harness() {
    const initOptions: Record<string, unknown> = {
      model: config.model ?? readString(env?.TRELLIS_MODEL) ?? "cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      sandbox: env?.TRELLIS_FLUE_SANDBOX,
      tools: Array.isArray(env?.TRELLIS_MCP_TOOLS) ? env.TRELLIS_MCP_TOOLS : (tools ?? createTrellisMcpTools(env, config)),
    };
    const cwd = readString(env?.TRELLIS_FLUE_CWD);
    if (cwd) {
      initOptions.cwd = cwd;
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
        context: input.context,
        ...(input.args ?? {}),
      };
      return session.skill(name, {
        args,
        role: input.role,
        model: input.model,
      });
    },
  };
}

async function processRuntimeSignals(
  agent: TrellisAgentDefinition<TrellisGtmApp>,
  env: Record<string, unknown> | undefined,
  signals: Array<Partial<TrellisSignal>>,
  context: Record<string, unknown> = {},
) {
  const packContext = await readPackContext(env);
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
    });
    const run = await runTrellisAgent(agent, {
      signal,
      context: {
        packs: packContext,
        ...context,
      },
      harness,
    });
    const persistence = await persistRuntimeResult(env, run);
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
  const providedSecret = bearer
    ?? readString(request.headers.get("x-trellis-webhook-secret"))
    ?? readString(request.headers.get("x-webhook-secret"));
  return {
    enabled: true,
    ok: providedSecret === configuredSecret,
  };
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
  const providedSecret = bearer
    ?? readString(request.headers.get("x-apify-webhook-secret"))
    ?? readString(request.headers.get("x-trellis-webhook-secret"))
    ?? readString(request.headers.get("x-webhook-secret"))
    ?? readString(url.searchParams.get("secret"));
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
  const providedSecret = bearer
    ?? readString(request.headers.get("x-agentmail-webhook-secret"))
    ?? readString(request.headers.get("x-trellis-webhook-secret"));
  return {
    enabled: true,
    ok: providedSecret === configuredSecret,
  };
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

async function persistRuntimeResult(env: Record<string, unknown> | undefined, run: TrellisRuntimeResult) {
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
    await insertTraceEvent(env, db, {
      id: `trace_event_${event.id}`,
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
    tables: ["trellis_signals", "trellis_prospects", "trellis_drafts", "trellis_approvals", "trellis_provider_runs", "trellis_provider_actions", "trellis_workflow_runs", "trellis_operator_controls", "trellis_smoke_runs", "trellis_audit_events", "trellis_trace_events"],
  };
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
}

async function runD1(db: TrellisD1Database, sql: string, bindings: unknown[] = []) {
  await db.prepare(sql).bind(...bindings).run();
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
  const createdAt = new Date().toISOString();
  const record: TrellisTraceEventRecord = {
    id: event.id,
    traceId: event.traceId,
    signalId: event.signalId ?? null,
    workflow: event.workflow ?? null,
    span: event.span,
    type: event.type,
    message: event.message,
    payload: event.payload ?? {},
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

async function scheduleFollowUpWorkflow(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
  result: TrellisProviderActionExecutionResult,
) {
  if (context.action.operation !== "email.send") {
    return {
      enabled: false,
      reason: "not_outbound_email",
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
    ?? defaultFollowUpDelay(env);
  const params = {
    workflowRunId: id,
    traceId: context.action.traceId,
    signal: trellisSignal,
    workflow: "follow_up",
    providerActionId: context.action.id,
    draftId: context.action.draftId ?? null,
    followUp: {
      delay,
      next: "draft_follow_up_if_no_reply",
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
      next: "draft_follow_up_if_no_reply",
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
  `).bind(workflowRunId).first<TrellisWorkflowRunRecord>();
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
    return config.email?.id ?? "email";
  }
  if (operation.startsWith("crm.")) {
    return config.crm?.id ?? "crm";
  }
  if (operation.startsWith("research.")) {
    return config.research?.id ?? "research";
  }
  if (operation.startsWith("handoff.")) {
    return config.handoff?.id ?? "handoff";
  }
  return "provider";
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
    const result = await dispatchProviderAction(env, context);
    const transition = await recordProviderActionTransition(env, {
      providerActionId: action.id,
      traceId: action.traceId,
      signalId: action.signalId,
      status: "completed",
      actor: execution.actor ?? "trellis-provider-executor",
      reason: execution.reason ?? `Executed ${action.operation} through ${action.provider}.`,
    });
    const followUpWorkflow = await scheduleFollowUpWorkflow(env, context, result).catch((followUpError: unknown) => ({
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
    reason: retry.reason ?? "Prepared provider action for Cloudflare queue retry.",
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
    input,
  };
}

async function dispatchProviderAction(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const boundExecutor = await dispatchWithBoundExecutor(env, context);
  if (boundExecutor) {
    return boundExecutor;
  }

  if (context.action.provider === "agentmail" && context.action.operation === "email.send") {
    return executeAgentMailSend(env, context);
  }

  if (
    context.action.provider === "agentmail"
    && (context.action.operation === "email.reply" || context.action.operation === "mail.reply")
  ) {
    return executeAgentMailReply(env, context);
  }

  if (
    context.action.provider === "attio"
    && (context.action.operation === "crm.update" || context.action.operation === "crm.syncProspect")
  ) {
    return executeAttioCrmUpdate(env, context);
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

async function executeAgentMailSend(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const apiKey = readString(env?.AGENTMAIL_API_KEY);
  if (!apiKey) {
    throw new Error("AGENTMAIL_API_KEY is not configured.");
  }

  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const inboxId = readFirstString(input, signalPayload, ["inboxId", "providerInboxId", "senderProviderInboxId"]);
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
    operation: "email.send",
    actionId: context.action.id,
    externalId: readString(record.id) ?? readString(record.message_id) ?? null,
    externalThreadId: readString(record.thread_id) ?? readString(record.threadId) ?? null,
    raw,
  };
}

async function executeAgentMailReply(
  env: Record<string, unknown> | undefined,
  context: TrellisProviderExecutionContext,
): Promise<TrellisProviderActionExecutionResult> {
  const apiKey = readString(env?.AGENTMAIL_API_KEY);
  if (!apiKey) {
    throw new Error("AGENTMAIL_API_KEY is not configured.");
  }

  const signalPayload = context.signal?.payload ?? {};
  const input = context.input;
  const inboxId = readFirstString(input, signalPayload, ["inboxId", "providerInboxId", "senderProviderInboxId"]);
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
  const hasCompanyUpdate = Boolean(companyName || companyDomain);
  const hasPersonUpdate = Boolean(personRecordId || fullName || email || linkedinUrl || twitterUrl);

  if (!hasCompanyUpdate && !hasPersonUpdate) {
    throw new Error("Attio CRM update requires company, domain, email, name, LinkedIn, or an Attio record id.");
  }

  const baseUrl = (readString(env?.ATTIO_BASE_URL) ?? "https://api.attio.com/v2").replace(/\/+$/, "");
  const providerHeaders = trellisProviderHeaders(context);
  const company = companyRecordId && hasCompanyUpdate
    ? await attioRequest(env, apiKey, baseUrl, `/objects/companies/records/${encodeURIComponent(companyRecordId)}`, "PATCH", {
        data: {
          values: buildAttioCompanyValues(companyName, companyDomain),
        },
      }, providerHeaders)
    : hasCompanyUpdate
      ? await attioRequest(env, apiKey, baseUrl, companyDomain
          ? "/objects/companies/records?matching_attribute=domains"
          : "/objects/companies/records", companyDomain ? "PUT" : "POST", {
            data: {
              values: buildAttioCompanyValues(companyName, companyDomain),
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
  const person = personValues
    ? personRecordId
      ? await attioRequest(env, apiKey, baseUrl, `/objects/people/records/${encodeURIComponent(personRecordId)}`, "PATCH", {
          data: { values: personValues },
        }, providerHeaders)
      : await attioRequest(env, apiKey, baseUrl, email
          ? "/objects/people/records?matching_attribute=email_addresses"
          : "/objects/people/records", email ? "PUT" : "POST", {
            data: { values: personValues },
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
  const apiKey = readString(env?.FIRECRAWL_API_KEY);
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured.");
  }

  const query = readFirstString(input, {}, ["query", "q"]);
  if (!query) {
    throw new Error("Firecrawl search requires a query.");
  }

  const limit = readNumber(input.limit) ?? 5;
  const sources = readFirecrawlSources(input.sources);
  const baseUrl = (readString(env?.FIRECRAWL_BASE_URL) ?? "https://api.firecrawl.dev").replace(/\/+$/, "");
  const response = await firecrawlRequest(env, apiKey, baseUrl, "/v2/search", {
    query,
    limit,
    sources,
    country: readString(input.country) ?? "US",
    ignoreInvalidURLs: true,
    ...(readString(input.tbs) ? { tbs: readString(input.tbs) } : {}),
  });
  const data = isRecord(response.data) ? response.data : {};
  const webResults = Array.isArray(data.web) ? data.web : [];
  const newsResults = Array.isArray(data.news) ? data.news : [];
  const arrayResults = Array.isArray(response.data) ? response.data : [];
  const results = [
    ...arrayResults.map((result) => mapFirecrawlSearchResult(result, "web")),
    ...webResults.map((result) => mapFirecrawlSearchResult(result, "web")),
    ...newsResults.map((result) => mapFirecrawlSearchResult(result, "news")),
  ].filter((result) => Boolean(result.url));

  return {
    provider: "firecrawl",
    operation: "research.search",
    query,
    results,
    raw: response,
  };
}

async function executeFirecrawlExtract(
  env: Record<string, unknown> | undefined,
  input: Record<string, unknown>,
) {
  const apiKey = readString(env?.FIRECRAWL_API_KEY);
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is not configured.");
  }

  const url = readFirstString(input, {}, ["url"]);
  if (!url) {
    throw new Error("Firecrawl extract requires a URL.");
  }

  const baseUrl = (readString(env?.FIRECRAWL_BASE_URL) ?? "https://api.firecrawl.dev").replace(/\/+$/, "");
  const response = await firecrawlRequest(env, apiKey, baseUrl, "/v1/scrape", {
    url,
    formats: ["markdown"],
  });
  const data = isRecord(response.data) ? response.data : {};

  return {
    provider: "firecrawl",
    operation: "research.extract",
    url,
    markdown: readString(data.markdown) ?? "",
    raw: response,
  };
}

async function firecrawlRequest(
  env: Record<string, unknown> | undefined,
  apiKey: string,
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
) {
  const fetcher = typeof env?.TRELLIS_FETCH === "function"
    ? env.TRELLIS_FETCH as typeof fetch
    : fetch;
  const response = await fetcher(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Firecrawl request failed with ${response.status}: ${await response.text()}`);
  }
  const parsed = await response.json().catch(() => ({}));
  return isRecord(parsed) ? parsed : {};
}

function readFirecrawlSources(value: unknown): Array<"web" | "news"> {
  if (!Array.isArray(value)) {
    return ["web"];
  }
  const sources = value.filter((source): source is "web" | "news" => source === "web" || source === "news");
  return sources.length > 0 ? sources : ["web"];
}

function mapFirecrawlSearchResult(value: unknown, source: "web" | "news") {
  const result = isRecord(value) ? value : {};
  return {
    title: readString(result.title) ?? "Untitled",
    url: readString(result.url) ?? "",
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
    };
  }

  return {
    enabled: true,
    counts: {
      signals: await countD1Rows(db, "trellis_signals"),
      prospects: await countD1Rows(db, "trellis_prospects"),
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
      <p>v3 Cloudflare GTM runtime</p>
      <p>No-send mode: ${agent.config.safety?.noSends ?? true}</p>
      <dl>
        <dt>Signals</dt><dd>${counts.signals}</dd>
        <dt>Prospects</dt><dd>${counts.prospects}</dd>
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
