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
  const app = createTrellisTestApp({
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
  const result = await agent.handler(app);
  const checks = [
    smokeCheck(
      "agent.manifest",
      agent.kind === "trellis.gtm.agent" && Boolean(agent.config.knowledge) && Boolean(agent.config.skills),
      "loaded Trellis v3 agent manifest with knowledge and skills",
    ),
    smokeCheck(
      "signal.accepted",
      app.auditEvents.some((event) => event.type === "signal.accepted"),
      "accepted one fixture GTM signal",
    ),
    smokeCheck(
      "skill.qualification",
      app.skillCalls.some((call) => call.name === "icp-qualification"),
      "ran icp-qualification through the Trellis skill API",
    ),
    smokeCheck(
      "workflow.prospect",
      app.startedWorkflows.some((workflow) => workflow.name === "prospect"),
      "started the prospect workflow",
    ),
    smokeCheck(
      "state.prospect",
      app.prospects.length === 1,
      "created a prospect state projection",
    ),
    smokeCheck(
      "draft.blocked",
      app.drafts.some((draft) => draft.status === "blocked_pending_approval"),
      "created an outbound draft without sending it",
    ),
    smokeCheck(
      "audit.events",
      ["signal.accepted", "skill.completed", "workflow.started", "draft.created"].every((type) =>
        app.auditEvents.some((event) => event.type === type),
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
    fixture: app.fixtureSignal,
    checks,
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
          return jsonResponse({
            ok: true,
            accepted: true,
            mode: "queued",
            noSendsMode: agent.config.safety?.noSends ?? true,
          }, 202);
        }

        if (url.pathname === "/mcp/trellis") {
          return jsonResponse({
            ok: true,
            server: "trellis",
            agent: agent.name,
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
          return new Response(renderDashboard(agent), {
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function renderDashboard(agent: TrellisAgentDefinition<TrellisGtmApp>) {
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
    </main>
  </body>
</html>`;
}
