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
  return {
    signal: app.fixtureSignal,
    skillCalls: app.skillCalls,
    startedWorkflows: app.startedWorkflows,
    prospects: app.prospects,
    drafts: app.drafts,
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
          const signal = await readSignalFromRequest(request);
          const run = await runTrellisAgent(agent, { signal });
          const persistence = await persistRuntimeResult(env, run);
          const queue = await enqueueRuntimeEvent(env, run);
          return jsonResponse({
            ok: true,
            accepted: true,
            mode: "processed",
            signal: run.signal,
            prospects: run.prospects,
            drafts: run.drafts,
            auditEvents: run.auditEvents,
            persistence,
            queue,
            noSendsMode: agent.config.safety?.noSends ?? true,
          }, 202);
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
          routes: ["/healthz", "/smoke", "/webhooks/signals", "/mcp/trellis", "/dashboard"],
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
  return {
    id: readString(record.id) ?? readString(record.signalId) ?? `sig_${now}`,
    threadId: readString(record.threadId) ?? `thr_${readString(record.id) ?? now}`,
    workspaceId: readString(record.workspaceId) ?? readString(record.workspace) ?? "wrk_default",
    campaignId: readString(record.campaignId) ?? readString(record.campaign),
    provider: readString(record.provider) ?? "webhook",
    source: readString(record.source) ?? "webhook.signals",
    payload: record,
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
    tables: ["trellis_signals", "trellis_prospects", "trellis_drafts", "trellis_audit_events"],
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
    auditEventIds: run.auditEvents.map((event) => event.id),
  });
  return {
    enabled: true,
    messages: 1,
  };
}

async function readRuntimeSnapshot(env: Record<string, unknown> | undefined) {
  const db = env?.TRELLIS_DB as TrellisD1Database | undefined;
  if (!db?.prepare) {
    return {
      enabled: false,
      counts: null,
    };
  }

  return {
    enabled: true,
    counts: {
      signals: await countD1Rows(db, "trellis_signals"),
      prospects: await countD1Rows(db, "trellis_prospects"),
      drafts: await countD1Rows(db, "trellis_drafts"),
      auditEvents: await countD1Rows(db, "trellis_audit_events"),
    },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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
    auditEvents: 0,
  };
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
        <dt>Audit Events</dt><dd>${counts.auditEvents}</dd>
      </dl>
    </main>
  </body>
</html>`;
}
