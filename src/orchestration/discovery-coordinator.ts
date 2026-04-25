import { actor } from "rivetkit";
import { db } from "rivetkit/db";

import type { AppConfig } from "../config.js";
import type { DiscoverySource, SandboxTurnRequest } from "../domain/types.js";
import { createId } from "../lib/ids.js";
import { ingestApifyRun } from "./source-ingest.js";
import {
  type DiscoveryTermCandidate,
  normalizeTerms,
  parseDiscoveryPlan,
  selectFallbackDiscoveryTerms,
} from "./discovery-planner.js";
import { getAppContext } from "../services/runtime-context.js";
import { runSandboxTurn } from "./sandbox-broker.js";
import { isWeekdayInTimezone } from "./discovery-window.js";
import { getAutomationPauseReason } from "./workflow-control.js";

interface DiscoveryActorState {
  campaignId: string | null;
  source: DiscoverySource | null;
  initialized: boolean;
  ticks: number;
  lastTickAt: number;
  nextTickAt: number;
  lastPlanner: string | null;
  lastRunId: string | null;
  lastTerm: string | null;
  lastStatus: string;
}

interface DiscoveryTickResult {
  ok: boolean;
  source: DiscoverySource;
  campaignId: string;
  scheduledNextTickAt: number;
  planner: string;
  startedRuns: Array<{
    actorRunId: string | null;
    term: string;
  }>;
  skipped?: boolean;
  reason?: string;
  failures?: Array<{
    term: string;
    error: string;
  }>;
}

interface RunCompletionPayload {
  actorRunId: string;
  source?: DiscoverySource;
  campaignId?: string;
  term?: string | null;
  defaultDatasetId?: string | null;
  metadata?: Record<string, unknown>;
}

const APIFY_RUN_POLL_DELAY_MS = 15_000;

export const discoveryCoordinator = actor({
  state: {
    campaignId: null as string | null,
    source: null as DiscoverySource | null,
    initialized: false as boolean,
    ticks: 0,
    lastTickAt: 0,
    nextTickAt: 0,
    lastPlanner: null as string | null,
    lastRunId: null as string | null,
    lastTerm: null as string | null,
    lastStatus: "idle" as string,
  } satisfies DiscoveryActorState,
  db: db({
    async onMigrate(database) {
      await database.execute(`
        create table if not exists discovery_terms (
          term text primary key,
          status text not null default 'seed',
          priority real not null default 0.7,
          total_runs integer not null default 0,
          total_signals integer not null default 0,
          total_prospects integer not null default 0,
          last_used_at integer,
          last_yield_at integer,
          last_actor_run_id text,
          last_error text,
          metadata text not null default '{}'
        );

        create table if not exists discovery_runs (
          actor_run_id text primary key,
          term text not null,
          status text not null,
          dataset_id text,
          items_seen integer,
          prospects_processed integer,
          created_at integer not null,
          completed_at integer,
          error text,
          metadata text not null default '{}'
        );

        create table if not exists discovery_source_state (
          singleton integer primary key check (singleton = 1),
          cursor text,
          last_tick_at integer,
          last_run_started_at integer,
          last_yield_at integer,
          consecutive_empty_runs integer not null default 0,
          last_planner text,
          metadata text not null default '{}'
        );

        insert or ignore into discovery_source_state (singleton, consecutive_empty_runs, metadata)
        values (1, 0, '{}');

        create index if not exists idx_discovery_runs_status on discovery_runs(status, created_at desc);
        create index if not exists idx_discovery_terms_priority on discovery_terms(priority desc, total_prospects desc);
      `);
    },
  }),
  actions: {
    initialize: async (
      c,
      input: {
        campaignId: string;
        source: DiscoverySource;
        runNow?: boolean;
      },
    ) => {
      c.state.campaignId = input.campaignId;
      c.state.source = input.source;
      await ensureSeedTerms(c.db, input.source);

      if (!c.state.initialized && input.runNow) {
        c.state.initialized = true;
        return runDiscoveryTick(c, { reason: "initialize" });
      }

      const alreadyScheduled = c.state.nextTickAt > Date.now();
      if (!alreadyScheduled) {
        c.state.nextTickAt = Date.now() + getAppContext().config.DISCOVERY_INTERVAL_MS;
        await c.schedule.after(getAppContext().config.DISCOVERY_INTERVAL_MS, "tick", {
          reason: "initialize",
        });
      }

      c.state.initialized = true;
      return {
        ok: true,
        source: input.source,
        campaignId: input.campaignId,
        scheduledNextTickAt: c.state.nextTickAt,
        planner: c.state.lastPlanner ?? "pending",
        startedRuns: [],
        skipped: true,
        reason: alreadyScheduled ? "tick already scheduled" : "initialized",
      } satisfies DiscoveryTickResult;
    },
    tick: async (
      c,
      input?: {
        reason?: string;
      },
    ) => runDiscoveryTick(c, input),
    enqueueTick: async (
      c,
      input?: {
        reason?: string;
      },
    ) => {
      await c.schedule.after(1, "tick", {
        reason: input?.reason ?? "manual_enqueue",
      });

      return {
        ok: true,
        queued: true,
        source: c.state.source,
        campaignId: c.state.campaignId,
      };
    },
    handleApifyRunCompleted: async (c, payload: RunCompletionPayload) => {
      return handleCompletedDiscoveryRun(c, payload);
    },
    pollRunStatus: async (c, payload: RunCompletionPayload) => {
      if (!payload.actorRunId) {
        throw new Error("actorRunId is required");
      }

      const existingRun = await c.db.execute<{
        status: string;
        dataset_id: string | null;
      }>(
        `
        select status, dataset_id
        from discovery_runs
        where actor_run_id = ?
        limit 1
        `,
        payload.actorRunId,
      );

      if (existingRun[0]?.status === "succeeded" || existingRun[0]?.status === "failed") {
        return {
          ok: true,
          actorRunId: payload.actorRunId,
          status: existingRun[0].status,
          skipped: true,
        };
      }

      const run = await getAppContext().apify.getRun(payload.actorRunId);
      if (run.status === "SUCCEEDED") {
        return handleCompletedDiscoveryRun(c, {
          ...payload,
          defaultDatasetId: payload.defaultDatasetId ?? run.defaultDatasetId,
        });
      }

      if (run.status === "FAILED" || run.status === "ABORTED" || run.status === "TIMED-OUT") {
        const now = Date.now();
        await c.db.execute(
          `
          update discovery_runs
          set status = 'failed',
              completed_at = ?,
              error = ?
          where actor_run_id = ?
          `,
          now,
          `Apify run ended with status ${run.status}`,
          payload.actorRunId,
        );
        c.state.lastStatus = "failed";
        return {
          ok: false,
          actorRunId: payload.actorRunId,
          status: run.status,
        };
      }

      await c.schedule.after(APIFY_RUN_POLL_DELAY_MS, "pollRunStatus", payload);
      return {
        ok: true,
        actorRunId: payload.actorRunId,
        status: run.status,
        waiting: true,
      };
    },
    addSeedTerms: async (
      c,
      input: {
        source?: DiscoverySource;
        terms: string[];
      },
    ) => {
      const source = input.source ?? c.state.source;
      if (!source) {
        throw new Error("discovery source is required");
      }

      const terms = normalizeTerms(input.terms);
      for (const term of terms) {
        await c.db.execute(
          `
          insert into discovery_terms (term, status, priority, metadata)
          values (?, 'seed', 0.72, '{}')
          on conflict(term)
          do nothing
          `,
          term,
        );
      }

      return {
        ok: true,
        source,
        termsAdded: terms.length,
      };
    },
    getSnapshot: async (c) => {
      const [terms, runs, sourceState] = await Promise.all([
        c.db.execute<{
          term: string;
          status: string;
          priority: number;
          total_runs: number;
          total_signals: number;
          total_prospects: number;
          last_used_at: number | null;
          last_yield_at: number | null;
          last_actor_run_id: string | null;
          last_error: string | null;
        }>(
          `
          select *
          from discovery_terms
          order by priority desc, total_prospects desc, total_signals desc, coalesce(last_used_at, 0) asc
          limit 25
          `,
        ),
        c.db.execute(
          `
          select *
          from discovery_runs
          order by created_at desc
          limit 25
          `,
        ),
        c.db.execute(
          `
          select *
          from discovery_source_state
          where singleton = 1
          `,
        ),
      ]);

      return {
        state: c.state,
        terms,
        runs,
        sourceState: sourceState[0] ?? null,
      };
    },
  },
});

async function handleCompletedDiscoveryRun(
  c: {
    state: DiscoveryActorState;
    db: {
      execute: <TRow extends Record<string, unknown> = Record<string, unknown>>(
        query: string,
        ...args: unknown[]
      ) => Promise<TRow[]>;
    };
  },
  payload: RunCompletionPayload,
) {
  if (!payload.actorRunId) {
    throw new Error("actorRunId is required");
  }

  const existingRun = await c.db.execute<{
    status: string;
    dataset_id: string | null;
  }>(
    `
    select status, dataset_id
    from discovery_runs
    where actor_run_id = ?
    limit 1
    `,
    payload.actorRunId,
  );
  if (existingRun[0]?.status === "succeeded") {
    c.state.lastStatus = "completed";
    return {
      ok: true,
      actorRunId: payload.actorRunId,
      status: "succeeded",
      skipped: true,
    };
  }

      const source = payload.source ?? c.state.source;
      if (!source) {
        throw new Error("discovery source is required");
      }

      const context = getAppContext();
      const campaignId = payload.campaignId ?? c.state.campaignId ?? (await context.repository.ensureDefaultCampaign()).id;
      c.state.campaignId = campaignId;
      c.state.source = source;

      const metadata = JSON.stringify(payload.metadata ?? {});
      const now = Date.now();

      await c.db.execute(
        `
        insert into discovery_runs (actor_run_id, term, status, dataset_id, created_at, metadata)
        values (?, ?, 'running', ?, ?, ?)
        on conflict(actor_run_id)
        do update set
          dataset_id = excluded.dataset_id,
          metadata = excluded.metadata
        `,
        payload.actorRunId,
        payload.term ?? "unknown",
        payload.defaultDatasetId ?? null,
        now,
        metadata,
      );

      try {
        const result = await ingestApifyRun(
          {
            context,
            runSandboxTurn: (request: SandboxTurnRequest) => runSandboxTurn(context, request),
          },
          {
            actorRunId: payload.actorRunId,
            source,
            campaignId,
            term: payload.term ?? null,
            datasetId: payload.defaultDatasetId ?? null,
          },
        );

        await c.db.execute(
          `
          update discovery_runs
          set status = 'succeeded',
              dataset_id = ?,
              items_seen = ?,
              prospects_processed = ?,
              completed_at = ?,
              error = null,
              metadata = ?
          where actor_run_id = ?
          `,
          payload.defaultDatasetId ?? null,
          result.itemsSeen,
          result.prospectsProcessed,
          now,
          metadata,
          payload.actorRunId,
        );

        if (payload.term) {
          await c.db.execute(
            `
            insert into discovery_terms (
              term,
              status,
              priority,
              total_runs,
              total_signals,
              total_prospects,
              last_used_at,
              last_yield_at,
              last_actor_run_id,
              last_error,
              metadata
            )
            values (
              ?, ?, 0.7, 0, ?, ?, ?, ?, ?, null, ?
            )
            on conflict(term)
            do update set
              status = excluded.status,
              total_signals = discovery_terms.total_signals + excluded.total_signals,
              total_prospects = discovery_terms.total_prospects + excluded.total_prospects,
              last_yield_at = excluded.last_yield_at,
              last_actor_run_id = excluded.last_actor_run_id,
              last_error = null,
              metadata = excluded.metadata
            `,
            payload.term,
            result.itemsSeen > 0 ? "active" : "seed",
            result.itemsSeen,
            result.prospectsProcessed,
            now,
            result.itemsSeen > 0 ? now : null,
            payload.actorRunId,
            metadata,
          );
        }

        await c.db.execute(
          `
          update discovery_source_state
          set last_yield_at = case when ? > 0 then ? else last_yield_at end,
              consecutive_empty_runs = case when ? > 0 then 0 else consecutive_empty_runs + 1 end,
              metadata = ?
          where singleton = 1
          `,
          result.itemsSeen,
          now,
          result.itemsSeen,
          metadata,
        );

        c.state.lastRunId = payload.actorRunId;
        c.state.lastTerm = payload.term ?? c.state.lastTerm;
        c.state.lastStatus = "completed";

        return {
          source,
          campaignId,
          ...result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await c.db.execute(
          `
          update discovery_runs
          set status = 'failed',
              completed_at = ?,
              error = ?,
              metadata = ?
          where actor_run_id = ?
          `,
          now,
          message,
          metadata,
          payload.actorRunId,
        );

        if (payload.term) {
          await c.db.execute(
            `
            insert into discovery_terms (term, status, priority, last_error, metadata)
            values (?, 'errored', 0.5, ?, ?)
            on conflict(term)
            do update set
              status = 'errored',
              last_error = excluded.last_error,
              metadata = excluded.metadata
            `,
            payload.term,
            message,
            metadata,
          );
        }

        c.state.lastStatus = "failed";
        throw error;
      }
}

async function runDiscoveryTick(
  c: {
    state: DiscoveryActorState;
    db: {
      execute: <TRow extends Record<string, unknown> = Record<string, unknown>>(
        query: string,
        ...args: unknown[]
      ) => Promise<TRow[]>;
    };
    schedule: {
      after: (duration: number, fn: string, ...args: unknown[]) => Promise<void>;
    };
    log: {
      warn: (payload: Record<string, unknown>) => void;
    };
  },
  input?: {
    reason?: string;
  },
): Promise<DiscoveryTickResult> {
  const context = getAppContext();
  const campaignId = c.state.campaignId ?? (await context.repository.ensureDefaultCampaign()).id;
  const source = c.state.source;
  if (!source) {
    throw new Error("discovery source is required");
  }

  c.state.initialized = true;
  c.state.campaignId = campaignId;
  c.state.lastTickAt = Date.now();
  c.state.ticks += 1;

  await ensureSeedTerms(c.db, source);

  let planner = "fallback";
  let startedRuns: DiscoveryTickResult["startedRuns"] = [];
  const failures: DiscoveryTickResult["failures"] = [];

  try {
    const campaign = await context.repository.getCampaign(campaignId);
    const controlFlags = await context.repository.getControlFlags();
    const automationPauseReason = getAutomationPauseReason(controlFlags, campaignId);
    if (automationPauseReason) {
      c.state.lastStatus = "paused";
      return {
        ok: true,
        source,
        campaignId,
        scheduledNextTickAt: await scheduleNextTick(c),
        planner,
        startedRuns,
        skipped: true,
        reason: automationPauseReason,
      };
    }
    if (!isSourceEnabled(context.config, campaign, source)) {
      c.state.lastStatus = "skipped";
      return {
        ok: true,
        source,
        campaignId,
        scheduledNextTickAt: await scheduleNextTick(c),
        planner,
        startedRuns,
        skipped: true,
        reason: `${source} discovery is disabled`,
      };
    }
    if (context.config.DISCOVERY_WEEKDAYS_ONLY && !isWeekdayInTimezone(new Date(), campaign.timezone)) {
      c.state.lastStatus = "skipped";
      return {
        ok: true,
        source,
        campaignId,
        scheduledNextTickAt: await scheduleNextTick(c),
        planner,
        startedRuns,
        skipped: true,
        reason: `discovery only runs on weekdays in ${campaign.timezone}`,
      };
    }
    if (!context.apify.hasDiscoveryTarget(source)) {
      c.state.lastStatus = "skipped";
      return {
        ok: true,
        source,
        campaignId,
        scheduledNextTickAt: await scheduleNextTick(c),
        planner,
        startedRuns,
        skipped: true,
        reason: `Apify target is not configured for ${source}`,
      };
    }

    const history = await loadDiscoveryHistory(c.db);
    const fallbackTerms = selectFallbackDiscoveryTerms({
      seedTerms: getSeedTerms(context.config, source),
      history,
      maxRuns: context.config.DISCOVERY_MAX_RUNS_PER_TICK,
    });

    let plannedTerms = fallbackTerms;
    const sandboxPlan = await planDiscoveryTerms({
      campaignId,
      source,
      history,
      fallbackTerms,
      maxRuns: context.config.DISCOVERY_MAX_RUNS_PER_TICK,
    }).catch((error) => {
      c.log.warn({
        msg: "sandbox discovery planner failed, falling back",
        source,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });

    if (sandboxPlan?.terms?.length) {
      plannedTerms = sandboxPlan.terms;
      planner = "sandbox";
    }

    if (!plannedTerms.length) {
      c.state.lastPlanner = planner;
      c.state.lastStatus = "skipped";
      return {
        ok: true,
        source,
        campaignId,
        scheduledNextTickAt: await scheduleNextTick(c),
        planner,
        startedRuns,
        skipped: true,
        reason: "no discovery terms available",
      };
    }

    for (const term of plannedTerms) {
      const metadata = JSON.stringify({
        planner,
        reason: term.reason,
        source,
        tickReason: input?.reason ?? null,
      });

      try {
        const started = await context.apify.startDiscoveryRun({
          campaignId,
          source,
          term: term.term,
          metadata: {
            planner,
            reason: term.reason,
          },
        });
        const now = Date.now();
        await c.db.execute(
          `
          insert into discovery_runs (actor_run_id, term, status, dataset_id, created_at, metadata)
          values (?, ?, 'running', ?, ?, ?)
          on conflict(actor_run_id)
          do update set
            term = excluded.term,
            status = excluded.status,
            dataset_id = excluded.dataset_id,
            metadata = excluded.metadata
          `,
          started.actorRunId,
          term.term,
          started.defaultDatasetId ?? null,
          now,
          metadata,
        );
        await c.db.execute(
          `
          insert into discovery_terms (
            term,
            status,
            priority,
            total_runs,
            last_used_at,
            last_actor_run_id,
            last_error,
            metadata
          )
          values (?, 'active', ?, 1, ?, ?, null, ?)
          on conflict(term)
          do update set
            status = 'active',
            priority = excluded.priority,
            total_runs = discovery_terms.total_runs + 1,
            last_used_at = excluded.last_used_at,
            last_actor_run_id = excluded.last_actor_run_id,
            last_error = null,
            metadata = excluded.metadata
          `,
          term.term,
          term.priority,
          now,
          started.actorRunId,
          metadata,
        );
        startedRuns = [
          ...startedRuns,
          {
            actorRunId: started.actorRunId,
            term: term.term,
          },
        ];
        await c.schedule.after(APIFY_RUN_POLL_DELAY_MS, "pollRunStatus", {
          actorRunId: started.actorRunId,
          source,
          campaignId,
          term: term.term,
          defaultDatasetId: started.defaultDatasetId ?? null,
          metadata: {
            planner,
            reason: term.reason,
            source,
            tickReason: input?.reason ?? null,
          },
        });
        c.state.lastRunId = started.actorRunId;
        c.state.lastTerm = term.term;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({
          term: term.term,
          error: message,
        });
        await c.db.execute(
          `
          insert into discovery_terms (term, status, priority, last_error, metadata)
          values (?, 'errored', ?, ?, ?)
          on conflict(term)
          do update set
            status = 'errored',
            priority = excluded.priority,
            last_error = excluded.last_error,
            metadata = excluded.metadata
          `,
          term.term,
          term.priority,
          message,
          metadata,
        );
      }
    }

    await c.db.execute(
      `
      update discovery_source_state
      set last_tick_at = ?,
          last_run_started_at = ?,
          last_planner = ?,
          metadata = ?
      where singleton = 1
      `,
      c.state.lastTickAt,
      startedRuns.length ? Date.now() : null,
      planner,
      JSON.stringify({
        source,
        tickReason: input?.reason ?? null,
        startedRuns: startedRuns.length,
      }),
    );

    c.state.lastPlanner = planner;
    c.state.lastStatus = startedRuns.length ? "running" : "skipped";
    return {
      ok: true,
      source,
      campaignId,
      scheduledNextTickAt: await scheduleNextTick(c),
      planner,
      startedRuns,
      skipped: startedRuns.length === 0,
      reason: startedRuns.length === 0 ? "no discovery runs started" : undefined,
      failures: failures.length ? failures : undefined,
    };
  } catch (error) {
    c.state.lastStatus = "failed";
    c.state.lastPlanner = planner;
    await scheduleNextTick(c);
    throw error;
  }
}

async function ensureSeedTerms(
  database: {
    execute: (query: string, ...args: unknown[]) => Promise<Record<string, unknown>[]>;
  },
  source: DiscoverySource,
) {
  const config = getAppContext().config;
  const terms = normalizeTerms(getSeedTerms(config, source));
  for (const term of terms) {
    await database.execute(
      `
      insert into discovery_terms (term, status, priority, metadata)
      values (?, 'seed', 0.72, '{}')
      on conflict(term)
      do nothing
      `,
      term,
    );
  }
}

async function loadDiscoveryHistory(database: {
  execute: <TRow extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    ...args: unknown[]
  ) => Promise<TRow[]>;
}) {
  const rows = await database.execute<{
    term: string;
    status: string;
    priority: number;
    total_runs: number;
    total_signals: number;
    total_prospects: number;
    last_used_at: number | null;
    last_yield_at: number | null;
  }>(
    `
    select
      term,
      status,
      priority,
      total_runs,
      total_signals,
      total_prospects,
      last_used_at,
      last_yield_at
    from discovery_terms
    order by priority desc, total_prospects desc, total_signals desc, coalesce(last_used_at, 0) asc
    limit 50
    `,
  );

  return rows.map(
    (row): DiscoveryTermCandidate => ({
      term: row.term,
      status: row.status,
      priority: Number(row.priority),
      totalRuns: Number(row.total_runs),
      totalSignals: Number(row.total_signals),
      totalProspects: Number(row.total_prospects),
      lastUsedAt: coerceNullableNumber(row.last_used_at),
      lastYieldAt: coerceNullableNumber(row.last_yield_at),
    }),
  );
}

async function planDiscoveryTerms(input: {
  campaignId: string;
  source: DiscoverySource;
  history: DiscoveryTermCandidate[];
  fallbackTerms: Array<{
    term: string;
    reason: string;
    priority: number;
  }>;
  maxRuns: number;
}) {
  const context = getAppContext();
  const knowledge = await context.knowledge.composeKnowledgeContext("icp product usp compliance handoff", 4);
  const historyLines = input.history
    .slice(0, 12)
    .map(
      (entry) =>
        `- ${entry.term} | runs=${entry.totalRuns} | signals=${entry.totalSignals} | prospects=${entry.totalProspects} | last_used=${entry.lastUsedAt ?? "never"}`,
    )
    .join("\n");
  const fallbackLines = input.fallbackTerms
    .map((term) => `- ${term.term} | priority=${term.priority} | reason=${term.reason}`)
    .join("\n");

  const turn = await runSandboxTurn(context, {
    turnId: createId("turn"),
    prospectId: `discovery:${input.campaignId}:${input.source}`,
    campaignId: input.campaignId,
    stage: "discovery",
    systemPrompt: [
      "You are the discovery planner for an outbound SDR system.",
      "Pick search terms that are likely to surface public buyer-signal posts for the ICP.",
      "Return JSON only.",
    ].join("\n"),
    prompt: [
      `Source: ${input.source}`,
      `Max terms: ${input.maxRuns}`,
      "",
      "Knowledge context:",
      knowledge || "No additional knowledge available.",
      "",
      "Recent discovery term history:",
      historyLines || "- none",
      "",
      "Fallback terms if you do nothing better:",
      fallbackLines || "- none",
      "",
      'Return: {"terms":[{"term":"...", "reason":"...", "priority":0.0}]}',
      "Keep terms short and search-oriented. Prefer concrete buying-signal queries over vague brand positioning.",
    ].join("\n"),
    metadata: {
      kind: "discovery-plan",
      source: input.source,
      maxRuns: input.maxRuns,
    },
  });

  return parseDiscoveryPlan(turn.outputText, input.maxRuns);
}

async function scheduleNextTick(c: {
  state: DiscoveryActorState;
  schedule: {
    after: (duration: number, fn: string, ...args: unknown[]) => Promise<void>;
  };
}) {
  const nextAt = Date.now() + getAppContext().config.DISCOVERY_INTERVAL_MS;
  c.state.nextTickAt = nextAt;
  await c.schedule.after(getAppContext().config.DISCOVERY_INTERVAL_MS, "tick", {
    reason: "scheduled",
  });
  return nextAt;
}

function getSeedTerms(config: AppConfig, source: DiscoverySource) {
  return source === "x_public_post" ? config.DISCOVERY_X_SEED_TERMS : config.DISCOVERY_LINKEDIN_SEED_TERMS;
}

function isSourceEnabled(
  config: AppConfig,
  campaign: {
    sourceLinkedinEnabled: boolean;
  },
  source: DiscoverySource,
) {
  if (source === "x_public_post") {
    return config.DISCOVERY_X_ENABLED;
  }

  return config.DISCOVERY_LINKEDIN_ENABLED && campaign.sourceLinkedinEnabled;
}

function coerceNullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}
