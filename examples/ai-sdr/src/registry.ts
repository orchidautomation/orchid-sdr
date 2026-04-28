import { actor, setup } from "rivetkit";
import { db } from "rivetkit/db";

import type { SandboxTurnRequest } from "./domain/types.js";
import { createId } from "./lib/ids.js";
import { discoveryCoordinator } from "./orchestration/discovery-coordinator.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { executeProspectWorkflow, processInboundReply } from "./orchestration/prospect-workflow.js";
import { ingestApifyRun } from "./orchestration/source-ingest.js";
import { getAppContext } from "./services/runtime-context.js";

interface SandboxJobRecord {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  prospectId: string;
  campaignId: string;
  metadata: Record<string, unknown>;
  outputText: string | null;
  usage: Record<string, unknown>;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapSandboxJobRow(row: {
  id: string;
  status: SandboxJobRecord["status"];
  stage: string;
  prospect_id: string;
  campaign_id: string;
  metadata_json: string;
  output_text: string | null;
  usage_json: string;
  error_text: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  updated_at: number;
}): SandboxJobRecord {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    prospectId: row.prospect_id,
    campaignId: row.campaign_id,
    metadata: parseJsonValue<Record<string, unknown>>(row.metadata_json, {}),
    outputText: row.output_text,
    usage: parseJsonValue<Record<string, unknown>>(row.usage_json, {}),
    error: row.error_text,
    createdAt: Number(row.created_at),
    startedAt: row.started_at === null ? null : Number(row.started_at),
    completedAt: row.completed_at === null ? null : Number(row.completed_at),
    updatedAt: Number(row.updated_at),
  };
}

const sourceIngest = actor({
  state: {
    lastActorRunId: null as string | null,
    ingestedRuns: 0,
  },
  actions: {
    ingestApifyRun: async (
      c,
      input: {
        actorRunId: string;
        source?: "linkedin_public_post" | "x_public_post";
        campaignId?: string;
        term?: string | null;
        datasetId?: string | null;
      },
    ) => {
      c.state.lastActorRunId = input.actorRunId;
      c.state.ingestedRuns += 1;
      return ingestApifyRun(
        {
          context: getAppContext(),
          runSandboxTurn: (request) => runSandboxTurn(getAppContext(), request),
        },
        input,
      );
    },
    getSnapshot: async (c) => ({
      state: c.state,
    }),
  },
});

const prospectThread = actor({
  state: {
    prospectId: null as string | null,
    threadId: null as string | null,
    lastOutcome: "noop" as string,
  },
  actions: {
    bootstrapFromSignal: async (
      c,
      input: {
        signalId: string;
        campaignId?: string;
      },
    ) => {
      const context = getAppContext();
      const campaign = input.campaignId ? await context.repository.getCampaign(input.campaignId) : await context.repository.ensureDefaultCampaign();
      const { prospectId, threadId } = await context.repository.createOrUpdateProspectFromSignal(
        input.signalId,
        campaign.id,
      );

      c.state.prospectId = prospectId;
      c.state.threadId = threadId;

      const outcome = await executeProspectWorkflow(
        {
          context,
          runSandboxTurn: (request) => runSandboxTurn(context, request),
        },
        prospectId,
      );

      c.state.lastOutcome = outcome.action;
      if (outcome.followupDelayMs) {
        await c.schedule.after(outcome.followupDelayMs, "runScheduledFollowup");
      }

      return outcome;
    },
    runLifecycle: async (
      c,
      input?: {
        prospectId?: string;
        forceFollowup?: boolean;
      },
    ) => {
      const prospectId = input?.prospectId ?? c.state.prospectId;
      if (!prospectId) {
        throw new Error("prospectId is required");
      }

      c.state.prospectId = prospectId;
      const context = getAppContext();
      const outcome = await executeProspectWorkflow(
        {
          context,
          runSandboxTurn: (request) => runSandboxTurn(context, request),
        },
        prospectId,
        {
          forceFollowup: input?.forceFollowup,
        },
      );
      c.state.lastOutcome = outcome.action;
      if (outcome.followupDelayMs) {
        await c.schedule.after(outcome.followupDelayMs, "runScheduledFollowup");
      }
      return outcome;
    },
    runScheduledFollowup: async (c) => {
      if (!c.state.prospectId) {
        return {
          ok: false,
          reason: "no prospect bound",
        };
      }

      const context = getAppContext();
      const outcome = await executeProspectWorkflow(
        {
          context,
          runSandboxTurn: (request) => runSandboxTurn(context, request),
        },
        c.state.prospectId,
        {
          forceFollowup: true,
        },
      );
      c.state.lastOutcome = outcome.action;
      if (outcome.followupDelayMs) {
        await c.schedule.after(outcome.followupDelayMs, "runScheduledFollowup");
      }
      return outcome;
    },
    handleInboundReply: async (
      c,
      input: {
        providerThreadId: string;
        providerMessageId?: string | null;
        subject?: string | null;
        bodyText: string;
        rawPayload?: Record<string, unknown>;
      },
    ) => {
      const context = getAppContext();
      const outcome = await processInboundReply(
        {
          context,
          runSandboxTurn: (request) => runSandboxTurn(context, request),
        },
        input,
      );
      if (outcome) {
        c.state.prospectId = outcome.prospectId;
        c.state.threadId = outcome.threadId;
        c.state.lastOutcome = outcome.action;
        if (outcome.followupDelayMs) {
          await c.schedule.after(outcome.followupDelayMs, "runScheduledFollowup");
        }
      }
      return outcome;
    },
  },
});

const campaignOps = actor({
  state: {
    lastMutationAt: 0,
  },
  actions: {
    setGlobalKillSwitch: async (c, enabled: boolean) => {
      await getAppContext().repository.setControlFlag("global_kill_switch", { enabled });
      c.state.lastMutationAt = Date.now();
      return { ok: true, enabled };
    },
    setNoSendsMode: async (c, enabled: boolean) => {
      await getAppContext().repository.setControlFlag("no_sends_mode", { enabled });
      c.state.lastMutationAt = Date.now();
      return { ok: true, enabled };
    },
    pauseCampaign: async (c, campaignId: string) => {
      const repository = getAppContext().repository;
      const flags = await repository.getControlFlags();
      const pausedCampaignIds = Array.from(new Set([...flags.pausedCampaignIds, campaignId]));
      await repository.setControlFlag("paused_campaigns", { campaignIds: pausedCampaignIds });
      c.state.lastMutationAt = Date.now();
      return { ok: true, pausedCampaignIds };
    },
    resumeCampaign: async (c, campaignId: string) => {
      const repository = getAppContext().repository;
      const flags = await repository.getControlFlags();
      const pausedCampaignIds = flags.pausedCampaignIds.filter((value) => value !== campaignId);
      await repository.setControlFlag("paused_campaigns", { campaignIds: pausedCampaignIds });
      c.state.lastMutationAt = Date.now();
      return { ok: true, pausedCampaignIds };
    },
    setLinkedinSourceEnabled: async (
      c,
      input: {
        campaignId: string;
        enabled: boolean;
      },
    ) => {
      await getAppContext().repository.setCampaignLinkedinSource(input.campaignId, input.enabled);
      c.state.lastMutationAt = Date.now();
      return {
        ok: true,
        ...input,
      };
    },
    getSnapshot: async (c) => {
      const context = getAppContext();
      return {
        state: c.state,
        flags: await context.repository.getControlFlags(),
      };
    },
  },
});

const sandboxBroker = actor({
  state: {
    runs: 0,
    lastTurnId: null as string | null,
    lastProspectId: null as string | null,
    lastStage: null as string | null,
    lastJobId: null as string | null,
  },
  db: db({
    async onMigrate(database) {
      await database.execute(`
        create table if not exists sandbox_jobs (
          id text primary key,
          status text not null,
          stage text not null,
          prospect_id text not null,
          campaign_id text not null,
          request_json text not null,
          metadata_json text not null default '{}',
          output_text text,
          usage_json text not null default '{}',
          error_text text,
          created_at integer not null,
          started_at integer,
          completed_at integer,
          updated_at integer not null
        );

        create index if not exists idx_sandbox_jobs_created_at on sandbox_jobs(created_at desc);
        create index if not exists idx_sandbox_jobs_status on sandbox_jobs(status, updated_at desc);
      `);
    },
  }),
  actions: {
    runTurn: async (c, request) => {
      const context = getAppContext();
      const response = await runSandboxTurn(context, request);
      c.state.runs += 1;
      c.state.lastTurnId = request.turnId;
      c.state.lastProspectId = request.prospectId;
      c.state.lastStage = request.stage;
      return response;
    },
    enqueueTurn: async (c, request: SandboxTurnRequest) => {
      const jobId = createId("job");
      const now = Date.now();

      await c.db.execute(
        `
        insert into sandbox_jobs (
          id,
          status,
          stage,
          prospect_id,
          campaign_id,
          request_json,
          metadata_json,
          created_at,
          updated_at
        )
        values (?, 'queued', ?, ?, ?, ?, ?, ?, ?)
        `,
        jobId,
        request.stage,
        request.prospectId,
        request.campaignId,
        JSON.stringify(request),
        JSON.stringify(request.metadata ?? {}),
        now,
        now,
      );

      await c.schedule.after(1, "processQueuedTurn", { jobId });
      c.state.lastJobId = jobId;

      return {
        ok: true,
        jobId,
        status: "queued" as const,
      };
    },
    processQueuedTurn: async (
      c,
      input: {
        jobId: string;
      },
    ) => {
      const rows = await c.db.execute<{
        id: string;
        status: SandboxJobRecord["status"];
        request_json: string;
      }>(
        `
        select id, status, request_json
        from sandbox_jobs
        where id = ?
        limit 1
        `,
        input.jobId,
      );
      const row = rows[0];
      if (!row) {
        throw new Error(`sandbox job ${input.jobId} not found`);
      }

      if (row.status === "running" || row.status === "succeeded") {
        return {
          ok: true,
          jobId: input.jobId,
          status: row.status,
          skipped: true,
        };
      }

      const request = parseJsonValue<SandboxTurnRequest | null>(row.request_json, null);
      if (!request) {
        throw new Error(`sandbox job ${input.jobId} request is invalid`);
      }

      const startedAt = Date.now();
      await c.db.execute(
        `
        update sandbox_jobs
        set status = 'running',
            started_at = ?,
            updated_at = ?
        where id = ?
        `,
        startedAt,
        startedAt,
        input.jobId,
      );

      try {
        const context = getAppContext();
        const response = await runSandboxTurn(context, request);
        const completedAt = Date.now();
        await c.db.execute(
          `
          update sandbox_jobs
          set status = 'succeeded',
              output_text = ?,
              usage_json = ?,
              completed_at = ?,
              updated_at = ?
          where id = ?
          `,
          response.outputText,
          JSON.stringify(response.usage ?? {}),
          completedAt,
          completedAt,
          input.jobId,
        );

        c.state.runs += 1;
        c.state.lastTurnId = request.turnId;
        c.state.lastProspectId = request.prospectId;
        c.state.lastStage = request.stage;
        c.state.lastJobId = input.jobId;

        return {
          ok: true,
          jobId: input.jobId,
          status: "succeeded" as const,
          outputText: response.outputText,
        };
      } catch (error) {
        const completedAt = Date.now();
        const message = error instanceof Error ? error.message : String(error);
        await c.db.execute(
          `
          update sandbox_jobs
          set status = 'failed',
              error_text = ?,
              completed_at = ?,
              updated_at = ?
          where id = ?
          `,
          message,
          completedAt,
          completedAt,
          input.jobId,
        );

        c.state.lastJobId = input.jobId;
        throw error;
      }
    },
    getJob: async (c, jobId: string) => {
      const rows = await c.db.execute<{
        id: string;
        status: SandboxJobRecord["status"];
        stage: string;
        prospect_id: string;
        campaign_id: string;
        metadata_json: string;
        output_text: string | null;
        usage_json: string;
        error_text: string | null;
        created_at: number;
        started_at: number | null;
        completed_at: number | null;
        updated_at: number;
      }>(
        `
        select *
        from sandbox_jobs
        where id = ?
        limit 1
        `,
        jobId,
      );

      const row = rows[0];
      return row ? mapSandboxJobRow(row) : null;
    },
    listJobs: async (c, input?: { limit?: number }) => {
      const limit = Math.max(1, Math.min(input?.limit ?? 20, 100));
      const rows = await c.db.execute<{
        id: string;
        status: SandboxJobRecord["status"];
        stage: string;
        prospect_id: string;
        campaign_id: string;
        metadata_json: string;
        output_text: string | null;
        usage_json: string;
        error_text: string | null;
        created_at: number;
        started_at: number | null;
        completed_at: number | null;
        updated_at: number;
      }>(
        `
        select *
        from sandbox_jobs
        order by created_at desc
        limit ?
        `,
        limit,
      );

      return rows.map(mapSandboxJobRow);
    },
    getSnapshot: async (c) => {
      const jobCounts = await c.db.execute<{
        status: SandboxJobRecord["status"];
        count: number;
      }>(
        `
        select status, count(*) as count
        from sandbox_jobs
        group by status
        `,
      );

      return {
        state: c.state,
        jobCounts: jobCounts.map((row) => ({
          status: row.status,
          count: Number(row.count),
        })),
      };
    },
  },
});

export const registry = setup({
  managerHost: "127.0.0.1",
  managerPort: 6420,
  use: {
    sourceIngest,
    prospectThread,
    campaignOps,
    sandboxBroker,
    discoveryCoordinator,
  },
});
