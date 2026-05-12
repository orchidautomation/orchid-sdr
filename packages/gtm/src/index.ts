import { z } from "zod";

export type TrellisProviderKind =
  | "crm"
  | "email"
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
  knowledge: string | string[];
  skills: string | string[];
  safety?: TrellisSafetyPolicy;
}

export interface TrellisSignal {
  id: string;
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
  type: string;
  message: string;
  signalId?: string;
  workflow?: string;
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

export interface TrellisCloudflareRuntime {
  TrellisAgent: new (state?: unknown, env?: unknown) => {
    fetch(request: Request): Promise<Response>;
  };
  ProspectWorkflow: new (env?: unknown) => {
    run(event?: unknown, step?: unknown): Promise<unknown>;
  };
  worker: {
    fetch(request: Request, env?: Record<string, unknown>): Promise<Response>;
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

interface TrellisD1Database {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown> | unknown;
      first<T = Record<string, unknown>>(): Promise<T | null> | T | null;
    };
  };
}

interface TrellisQueue {
  send(message: unknown): Promise<unknown> | unknown;
}

interface TrellisR2Bucket {
  get(key: string): Promise<{ text(): Promise<string> | string } | null> | { text(): Promise<string> | string } | null;
  list?(options?: { prefix?: string }): Promise<{ objects?: Array<{ key: string; size?: number }> }> | { objects?: Array<{ key: string; size?: number }> };
}

type TrellisApprovalDecisionStatus = "approved" | "rejected";
type TrellisProviderActionTransitionStatus = "completed" | "failed";

interface TrellisApprovalDecision {
  approvalId: string;
  signalId: string;
  status: TrellisApprovalDecisionStatus;
  action: string;
  draftId?: string;
  actor?: string;
  reason?: string;
}

interface TrellisProviderActionTransition {
  providerActionId: string;
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

interface TrellisProviderActionRecord extends TrellisProviderAction {
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface TrellisDraftRecord {
  id: string;
  signalId: string;
  channel: string;
  status: string;
  body: string;
}

interface TrellisSignalRecord {
  id: string;
  workspaceId: string;
  threadId: string;
  payload: Record<string, unknown>;
}

interface TrellisProviderExecutionContext {
  action: TrellisProviderActionRecord;
  draft: TrellisDraftRecord | null;
  signal: TrellisSignalRecord | null;
  input: Record<string, unknown>;
}

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
      requireApproval: input?.requireApproval ?? ["email.send", "crm.update"],
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
}) {
  const startedWorkflows: Array<{ name: string; input: TrellisWorkflowStartInput }> = [];
  const skillCalls: Array<{ name: string; context: Record<string, unknown> }> = [];
  const prospects: TrellisProspect[] = [];
  const drafts: TrellisDraft[] = [];
  const auditEvents: TrellisAuditEvent[] = [];
  const signal: TrellisSignal = {
    id: input?.signal?.id ?? "sig_test",
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
        id: `evt_${auditEvents.length + 1}`,
        type: "signal.accepted",
        message: "Accepted fixture signal.",
        signalId: signal.id,
      });
      return signal;
    },
    context(currentSignal) {
      return {
        signal: currentSignal,
        ...(input?.context ?? {}),
      };
    },
    skill(name, skillInput) {
      skillCalls.push({
        name,
        context: skillInput.context,
      });
      const result = input?.skillResults?.[name] ?? {
        decision: "needs_review",
        summary: "Fixture qualification result.",
        confidence: 0.5,
        matchedEvidence: [],
        missingEvidence: [],
      };
      const parsed = skillInput.schema ? skillInput.schema.parse(result) : result;
      auditEvents.push({
        id: `evt_${auditEvents.length + 1}`,
        type: "skill.completed",
        message: `Completed skill ${name}.`,
        signalId: signal.id,
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
          drafts.push({
            id: `draft_${signal.id}`,
            channel: "email",
            status: "blocked_pending_approval",
            approvalRequiredFor: ["email.send", "crm.update"],
            body: "Fixture outbound draft. Not sent.",
          });
          auditEvents.push({
            id: `evt_${auditEvents.length + 1}`,
            type: "workflow.started",
            message: `Started workflow ${name}.`,
            signalId: signal.id,
            workflow: name,
          });
          auditEvents.push({
            id: `evt_${auditEvents.length + 1}`,
            type: "draft.created",
            message: "Created draft and blocked side effects pending approval.",
            signalId: signal.id,
            workflow: name,
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

  return app;
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
    const qualification = await app.skill("icp-qualification", {
      context: await app.context(signal),
      schema: schema.qualification(),
    });

    return app.workflow("prospect").start({ signal, qualification });
  });
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

function createApprovalsForDrafts(signal: TrellisSignal, drafts: TrellisDraft[]): TrellisApproval[] {
  return drafts.flatMap((draft) =>
    draft.approvalRequiredFor.map((action) => ({
      id: `approval_${draft.id}_${action.replace(/[^a-z0-9]+/gi, "_")}`,
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

function inferApprovalAction(approvalId: string) {
  if (approvalId.endsWith("_email_send")) {
    return "email.send";
  }
  if (approvalId.endsWith("_crm_update")) {
    return "crm.update";
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

    async fetch() {
      return jsonResponse({
        ok: true,
        runtime: "trellis-agent",
        agent: agent.name,
        storage: "durable-object-sqlite",
        state: Boolean(this.state),
        env: Boolean(this.env),
      });
    }
  }

  class ProspectWorkflowObject {
    constructor(private readonly env?: unknown) {}

    async run() {
      const smoke = await runTrellisSmoke({ agent });
      return {
        ok: smoke.ok,
        workflow: "prospect",
        agent: agent.name,
        noSendsMode: smoke.noSendsMode,
        externalWrites: smoke.externalWrites,
        env: Boolean(this.env),
      };
    }
  }

  return {
    TrellisAgent: TrellisAgentObject,
    ProspectWorkflow: ProspectWorkflowObject,
    worker: {
      async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === "/healthz") {
          return jsonResponse({
            ok: true,
            agent: agent.name,
            stack: "trellis-v3-cloudflare",
            safety: agent.config.safety ?? trellis.safeOutbound(),
            bindings: summarizeCloudflareBindings(env),
          });
        }

        if (url.pathname === "/smoke") {
          return jsonResponse(await runTrellisSmoke({ agent }));
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
          const signal = await readSignalFromRequest(request);
          const packContext = await readPackContext(env);
          const run = await runTrellisAgent(agent, {
            signal,
            context: {
              packs: packContext,
            },
          });
          const persistence = await persistRuntimeResult(env, run);
          const queue = await enqueueRuntimeEvent(env, run);
          return jsonResponse({
            ok: true,
            accepted: true,
            mode: "processed",
            signal: run.signal,
            prospects: run.prospects,
            drafts: run.drafts,
            approvals: run.approvals,
            auditEvents: run.auditEvents,
            persistence,
            queue,
            webhook: {
              verified: verification.enabled,
              idempotencyKey: run.signal.idempotencyKey ?? null,
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

        if (url.pathname === "/mcp/trellis") {
          return jsonResponse({
            ok: true,
            server: "trellis",
            agent: agent.name,
            snapshot: await readRuntimeSnapshot(env),
            tools: [
              "trellis.health",
              "trellis.smoke",
              "trellis.signal.inspect",
              "trellis.workflow.inspect",
              "trellis.approval.approve",
              "trellis.approval.reject",
              "trellis.providerAction.inspect",
              "trellis.providerAction.execute",
              "trellis.providerAction.complete",
              "trellis.providerAction.fail",
              "trellis.audit.search",
            ],
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
            "/approvals/:id/approve",
            "/approvals/:id/reject",
            "/provider-actions",
            "/provider-actions/:id/execute",
            "/provider-actions/:id/complete",
            "/provider-actions/:id/fail",
            "/mcp/trellis",
            "/dashboard",
          ],
        });
      },
    },
  };
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

async function readSignalFromRequest(request: Request): Promise<Partial<TrellisSignal>> {
  const payload = await readJsonBody(request);
  const record = isRecord(payload) ? payload : {};
  const now = Date.now();
  const idempotencyKey = readString(request.headers.get("idempotency-key"))
    ?? readString(request.headers.get("x-trellis-idempotency-key"))
    ?? readString(record.idempotencyKey);
  const explicitId = readString(record.id) ?? readString(record.signalId);
  const signalId = explicitId
    ?? (idempotencyKey ? `sig_${normalizeIdPart(idempotencyKey)}` : undefined)
    ?? `sig_${now}`;
  return {
    id: signalId,
    threadId: readString(record.threadId) ?? `thr_${signalId}`,
    workspaceId: readString(record.workspaceId) ?? readString(record.workspace) ?? "wrk_default",
    campaignId: readString(record.campaignId) ?? readString(record.campaign),
    idempotencyKey,
    provider: readString(record.provider) ?? "webhook",
    source: readString(record.source) ?? "webhook.signals",
    payload: record,
  };
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

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
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
    JSON.stringify(run.signal.payload ?? {}),
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
  }

  return {
    enabled: true,
    tables: ["trellis_signals", "trellis_prospects", "trellis_drafts", "trellis_approvals", "trellis_provider_actions", "trellis_audit_events"],
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
}

async function runD1(db: TrellisD1Database, sql: string, bindings: unknown[] = []) {
  await db.prepare(sql).bind(...bindings).run();
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
    traceId: `trace_${decision.signalId}_${decision.approvalId}`,
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
  }

  return {
    enabled: true,
    tables: providerAction
      ? ["trellis_approvals", "trellis_provider_actions", "trellis_audit_events"]
      : ["trellis_approvals", "trellis_audit_events"],
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

  return {
    enabled: true,
    tables: ["trellis_provider_actions", "trellis_audit_events"],
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

  const context = await readProviderActionContext(db, action, execution.input ?? {});
  try {
    const result = await dispatchProviderAction(env, context);
    const transition = await recordProviderActionTransition(env, {
      providerActionId: action.id,
      signalId: action.signalId,
      status: "completed",
      actor: execution.actor ?? "trellis-provider-executor",
      reason: execution.reason ?? `Executed ${action.operation} through ${action.provider}.`,
    });
    return {
      status: 200,
      body: {
        ok: true,
        providerAction: {
          ...action,
          status: "completed",
        },
        execution: result,
        ...transition,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const transition = await recordProviderActionTransition(env, {
      providerActionId: action.id,
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
      payload_json AS payloadJson
    FROM trellis_signals
    WHERE id = ?
  `).bind(action.signalId).first<Record<string, unknown>>();

  return {
    action,
    draft,
    signal: signal
      ? {
          id: String(signal.id),
          workspaceId: String(signal.workspaceId),
          threadId: String(signal.threadId),
          payload: parseRecordJson(signal.payloadJson),
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
      headers: { "content-type": "application/json" },
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
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
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
      packs,
    };
  }

  return {
    enabled: true,
    counts: {
      signals: await countD1Rows(db, "trellis_signals"),
      prospects: await countD1Rows(db, "trellis_prospects"),
      drafts: await countD1Rows(db, "trellis_drafts"),
      approvals: await countD1Rows(db, "trellis_approvals"),
      providerActions: await countD1Rows(db, "trellis_provider_actions"),
      auditEvents: await countD1Rows(db, "trellis_audit_events"),
    },
    packs,
  };
}

async function countD1Rows(db: TrellisD1Database, tableName: string) {
  try {
    const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).bind().first<{ count: number }>();
    return Number(row?.count ?? 0);
  } catch {
    return 0;
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

  return {
    enabled: true,
    knowledge: {
      manifest: manifest
        ? {
            source: typeof manifest.source === "string" ? manifest.source : null,
            files: Array.isArray(manifest.files) ? manifest.files.length : 0,
          }
        : null,
      objects: objects.filter((object) => object.key.startsWith("knowledge/files/")).length,
    },
    skills: {
      objects: objects.filter((object) => object.key.startsWith("skills/files/")).length,
    },
  };
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
    providerActions: 0,
    auditEvents: 0,
  };
  const packs = snapshot.packs;
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
        <dt>Provider Actions</dt><dd>${counts.providerActions}</dd>
        <dt>Audit Events</dt><dd>${counts.auditEvents}</dd>
        <dt>Knowledge Files</dt><dd>${packs.knowledge?.manifest?.files ?? 0}</dd>
        <dt>Skill Files</dt><dd>${packs.skills?.objects ?? 0}</dd>
      </dl>
    </main>
  </body>
</html>`;
}
