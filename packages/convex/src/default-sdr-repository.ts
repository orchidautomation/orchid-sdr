import {
  internalMutationGeneric as internalMutation,
  internalQueryGeneric as internalQuery,
  mutationGeneric as mutation,
  queryGeneric as query,
} from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

const DEFAULT_CAMPAIGN_ID = "cmp_default";

const qualificationCheck = v.object({
  key: v.string(),
  label: v.string(),
  passed: v.boolean(),
  detail: v.string(),
  kind: v.string(),
});

const qualificationAssessment = v.object({
  engine: v.string(),
  ruleVersion: v.string(),
  decision: v.string(),
  ok: v.boolean(),
  reason: v.string(),
  summary: v.string(),
  confidence: v.number(),
  matchedSegments: v.array(v.string()),
  matchedSignals: v.array(v.string()),
  disqualifiers: v.array(v.string()),
  dimensions: v.optional(v.any()),
  missingEvidence: v.optional(v.array(v.string())),
  checks: v.array(qualificationCheck),
});

const messageInsertInput = v.object({
  threadId: v.string(),
  providerMessageId: v.optional(nullableString),
  direction: v.string(),
  kind: v.string(),
  subject: v.optional(nullableString),
  bodyText: v.string(),
  bodyHtml: v.optional(nullableString),
  classification: v.optional(nullableString),
  metadata: v.optional(v.any()),
});

const signalInsertInput = v.object({
  id: v.string(),
  campaignId: v.string(),
  source: v.string(),
  sourceRef: v.string(),
  actorRunId: v.optional(nullableString),
  datasetId: v.optional(nullableString),
  url: v.string(),
  authorName: v.string(),
  authorTitle: v.optional(nullableString),
  authorCompany: v.optional(nullableString),
  companyDomain: v.optional(nullableString),
  twitterUrl: v.optional(nullableString),
  topic: v.string(),
  content: v.string(),
  capturedAt: v.number(),
  metadata: v.any(),
});

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDomain(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeProspectTitleCandidate(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }
  if (/^\d[\d,\s.]*\s+(followers|connections)\b/i.test(normalized)) {
    return null;
  }
  if (/\b(followers|connections)\b/i.test(normalized) && !/\bat\b|@|\bfounder\b|\bceo\b|\bcto\b|\bvp\b|\bdirector\b|\bhead\b|\blead\b|\banalyst\b|\bmanager\b/i.test(normalized)) {
    return null;
  }
  return normalized;
}

function isNoisyProspectTitle(value: string | null | undefined) {
  return normalizeProspectTitleCandidate(value) === null && Boolean(value?.trim());
}

function looksLikeNoisyProspectTitle(value: string | null | undefined) {
  const title = value?.trim();
  if (!title) {
    return false;
  }

  return /\b[\d,.]+\s+(followers?|connections?)\b/i.test(title);
}

function sanitizeProspectTitle(value: string | null | undefined) {
  const title = value?.trim();
  if (!title || looksLikeNoisyProspectTitle(title)) {
    return null;
  }

  return title;
}

function toIso(value: number | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

async function getCampaignDocById(ctx: any, id: string) {
  return ctx.db.query("campaigns").withIndex("by_campaign_id", (q: any) => q.eq("id", id)).unique();
}

async function getSignalDocById(ctx: any, id: string) {
  return ctx.db.query("signals").withIndex("by_signal_id", (q: any) => q.eq("id", id)).unique();
}

async function getProspectDocById(ctx: any, id: string) {
  return ctx.db.query("prospects").withIndex("by_prospect_id", (q: any) => q.eq("id", id)).unique();
}

async function getThreadDocById(ctx: any, id: string) {
  return ctx.db.query("threads").withIndex("by_thread_id", (q: any) => q.eq("id", id)).unique();
}

async function getThreadDocByProspectId(ctx: any, prospectId: string) {
  const rows = await ctx.db.query("threads").withIndex("by_prospect", (q: any) => q.eq("prospectId", prospectId)).collect();
  return rows[0] ?? null;
}

async function getBestContactEmailDoc(ctx: any, prospectId: string) {
  const rows = await ctx.db
    .query("contactMethods")
    .withIndex("by_prospect_kind", (q: any) => q.eq("prospectId", prospectId).eq("kind", "email"))
    .collect();

  return [...rows]
    .sort((a, b) => (b.confidence - a.confidence) || (b.updatedAt - a.updatedAt))[0] ?? null;
}

async function getLatestResearchBriefDoc(ctx: any, prospectId: string) {
  const rows = await ctx.db
    .query("researchBriefs")
    .withIndex("by_prospect", (q: any) => q.eq("prospectId", prospectId))
    .collect();

  return [...rows].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

async function getMessagesForThread(ctx: any, threadId: string) {
  const rows = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q: any) => q.eq("threadId", threadId))
    .collect();

  return [...rows].sort((a, b) => a.createdAt - b.createdAt);
}

async function getControlFlagValue(ctx: any, key: string) {
  return ctx.db.query("controlFlags").withIndex("by_key", (q: any) => q.eq("key", key)).unique();
}

function mapCampaign(doc: any) {
  return {
    id: doc.id,
    name: doc.name,
    status: doc.status,
    timezone: doc.timezone,
    quietHoursStart: doc.quietHoursStart,
    quietHoursEnd: doc.quietHoursEnd,
    touchCap: doc.touchCap,
    emailConfidenceThreshold: Number(doc.emailConfidenceThreshold),
    researchConfidenceThreshold: Number(doc.researchConfidenceThreshold),
    sourceLinkedinEnabled: Boolean(doc.sourceLinkedinEnabled),
    senderEmail: doc.senderEmail ?? null,
    senderDisplayName: doc.senderDisplayName ?? null,
    senderProviderInboxId: doc.senderProviderInboxId ?? null,
  };
}

function mapQualification(value: any) {
  return value && typeof value === "object" ? value : null;
}

function mapSignal(doc: any) {
  if (!doc) {
    return null;
  }

  return {
    id: doc.id,
    campaignId: doc.campaignId,
    source: doc.source,
    sourceRef: doc.sourceRef,
    actorRunId: doc.actorRunId ?? null,
    url: doc.url,
    authorName: doc.authorName,
    authorTitle: doc.authorTitle ?? null,
    authorCompany: doc.authorCompany ?? null,
    companyDomain: doc.companyDomain ?? null,
    twitterUrl: doc.twitterUrl ?? null,
    topic: doc.topic,
    content: doc.content,
    capturedAt: doc.capturedAt,
    metadata: doc.metadata ?? {},
  };
}

function mapProspectDashboardRow(doc: any) {
  return {
    id: doc.id,
    fullName: doc.fullName,
    company: doc.company ?? null,
    title: doc.title ?? null,
    stage: doc.stage,
    status: doc.status,
    isQualified: Boolean(doc.isQualified),
    qualificationReason: doc.qualificationReason ?? null,
    qualification: mapQualification(doc.qualification),
    pausedReason: doc.pausedReason ?? null,
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

function summarizeWorkflowFailure(input: {
  checkpoints?: any[];
  auditEvents?: any[];
}) {
  const checkpointFailure = [...(input.checkpoints ?? [])]
    .filter((item) => item?.status === "failed")
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (checkpointFailure) {
    return checkpointFailure.error ?? checkpointFailure.output?.error ?? null;
  }

  const auditFailure = [...(input.auditEvents ?? [])]
    .filter((item) => item?.eventName === "ProspectWorkflowFailed")
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (auditFailure) {
    return typeof auditFailure.payload?.error === "string" ? auditFailure.payload.error : null;
  }

  return null;
}

export const ensureDefaultCampaign = mutation({
  args: {
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await getCampaignDocById(ctx, DEFAULT_CAMPAIGN_ID);
    if (existing) {
      return mapCampaign(existing);
    }

    const timestamp = now();
    await ctx.db.insert("campaigns", {
      id: DEFAULT_CAMPAIGN_ID,
      name: "Default SDR Campaign",
      status: "active",
      timezone: args.timezone ?? "UTC",
      quietHoursStart: 21,
      quietHoursEnd: 8,
      touchCap: 5,
      emailConfidenceThreshold: 0.75,
      researchConfidenceThreshold: 0.65,
      sourceLinkedinEnabled: true,
      senderEmail: null,
      senderDisplayName: null,
      senderProviderInboxId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const created = await getCampaignDocById(ctx, DEFAULT_CAMPAIGN_ID);
    return mapCampaign(created);
  },
});

export const getCampaign = query({
  args: {
    campaignId: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await getCampaignDocById(ctx, args.campaignId);
    if (!campaign) {
      throw new Error(`campaign ${args.campaignId} not found`);
    }
    return mapCampaign(campaign);
  },
});

export const getControlFlags = query({
  args: {},
  handler: async (ctx) => {
    const [globalKillSwitch, noSendsMode, pausedCampaigns] = await Promise.all([
      getControlFlagValue(ctx, "global_kill_switch"),
      getControlFlagValue(ctx, "no_sends_mode"),
      getControlFlagValue(ctx, "paused_campaigns"),
    ]);

    return {
      globalKillSwitch: Boolean(globalKillSwitch?.value?.enabled),
      noSendsMode: Boolean(noSendsMode?.value?.enabled),
      pausedCampaignIds: Array.isArray(pausedCampaigns?.value?.campaignIds)
        ? pausedCampaigns.value.campaignIds
        : [],
    };
  },
});

export const setControlFlag = mutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await getControlFlagValue(ctx, args.key);
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: now(),
      });
      return;
    }

    await ctx.db.insert("controlFlags", {
      key: args.key,
      value: args.value,
      updatedAt: now(),
    });
  },
});

export const setCampaignLinkedinSource = mutation({
  args: {
    campaignId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const campaign = await getCampaignDocById(ctx, args.campaignId);
    if (!campaign) {
      throw new Error(`campaign ${args.campaignId} not found`);
    }
    await ctx.db.patch(campaign._id, {
      sourceLinkedinEnabled: args.enabled,
      updatedAt: now(),
    });
  },
});

export const setCampaignTimezone = mutation({
  args: {
    campaignId: v.string(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await getCampaignDocById(ctx, args.campaignId);
    if (!campaign) {
      throw new Error(`campaign ${args.campaignId} not found`);
    }
    await ctx.db.patch(campaign._id, {
      timezone: args.timezone,
      updatedAt: now(),
    });
  },
});

export const updateCampaignSenderIdentity = mutation({
  args: {
    campaignId: v.string(),
    senderEmail: v.optional(nullableString),
    senderDisplayName: v.optional(nullableString),
    senderProviderInboxId: v.optional(nullableString),
  },
  handler: async (ctx, args) => {
    const campaign = await getCampaignDocById(ctx, args.campaignId);
    if (!campaign) {
      throw new Error(`campaign ${args.campaignId} not found`);
    }

    await ctx.db.patch(campaign._id, {
      ...(args.senderEmail !== undefined ? { senderEmail: args.senderEmail } : {}),
      ...(args.senderDisplayName !== undefined ? { senderDisplayName: args.senderDisplayName } : {}),
      ...(args.senderProviderInboxId !== undefined ? { senderProviderInboxId: args.senderProviderInboxId } : {}),
      updatedAt: now(),
    });
  },
});

export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const [signals, prospects, threads, providerRuns, flags] = await Promise.all([
      ctx.db.query("signals").collect(),
      ctx.db.query("prospects").collect(),
      ctx.db.query("threads").collect(),
      ctx.db.query("providerRuns").collect(),
      (async () => {
        const [globalKillSwitch, noSendsMode] = await Promise.all([
          getControlFlagValue(ctx, "global_kill_switch"),
          getControlFlagValue(ctx, "no_sends_mode"),
        ]);
        return {
          globalKillSwitch: Boolean(globalKillSwitch?.value?.enabled),
          noSendsMode: Boolean(noSendsMode?.value?.enabled),
        };
      })(),
    ]);

    const nowMs = now();
    return {
      signals: signals.length,
      prospects: prospects.length,
      qualifiedLeads: prospects.filter((item) => item.isQualified).length,
      activeThreads: threads.filter((item) => item.status === "active").length,
      pausedThreads: threads.filter((item) => item.status === "paused").length,
      providerRuns24h: providerRuns.filter((item) => item.createdAt >= nowMs - (24 * 60 * 60 * 1000)).length,
      globalKillSwitch: flags.globalKillSwitch,
      noSendsMode: flags.noSendsMode,
    };
  },
});

export const listRecentSignals = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("signals").collect();
    return [...rows]
      .sort((a, b) => b.capturedAt - a.capturedAt)
      .slice(0, args.limit ?? 20)
      .map((row) => ({
        id: row.id,
        source: row.source,
        topic: row.topic,
        authorName: row.authorName,
        authorCompany: row.authorCompany ?? null,
        url: row.url,
        capturedAt: new Date(row.capturedAt).toISOString(),
      }));
  },
});

export const listRecentProspects = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("prospects").collect();
    return [...rows]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, args.limit ?? 20)
      .map(mapProspectDashboardRow);
  },
});

export const auditDataQuality = query({
  args: {
    limit: v.optional(v.number()),
    staleMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 250));
    const staleMinutes = Math.max(5, args.staleMinutes ?? 90);
    const staleCutoff = now() - (staleMinutes * 60 * 1000);
    const prospects = (await ctx.db.query("prospects").collect())
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const noisyTitleProspects: Array<Record<string, unknown>> = [];
    const staleCaptureSignalProspects: Array<Record<string, unknown>> = [];
    const qualifiedWithoutResearchBrief: Array<Record<string, unknown>> = [];

    for (const prospect of prospects) {
      if (noisyTitleProspects.length < limit && isNoisyProspectTitle(prospect.title ?? null)) {
        const signal = prospect.sourceSignalId ? await getSignalDocById(ctx, prospect.sourceSignalId) : null;
        noisyTitleProspects.push({
          prospectId: prospect.id,
          fullName: prospect.fullName,
          title: prospect.title ?? null,
          replacementTitle: normalizeProspectTitleCandidate(signal?.authorTitle ?? null),
          sourceSignalId: prospect.sourceSignalId ?? null,
          updatedAt: toIso(prospect.updatedAt),
        });
      }

      if (
        staleCaptureSignalProspects.length < limit
        && prospect.stage === "capture_signal"
        && prospect.status === "active"
        && !prospect.qualification
        && prospect.updatedAt <= staleCutoff
      ) {
        const thread = await getThreadDocByProspectId(ctx, prospect.id);
        staleCaptureSignalProspects.push({
          prospectId: prospect.id,
          threadId: thread?.id ?? null,
          fullName: prospect.fullName,
          title: prospect.title ?? null,
          pausedReason: prospect.pausedReason ?? null,
          updatedAt: toIso(prospect.updatedAt),
        });
      }

      if (
        qualifiedWithoutResearchBrief.length < limit
        && prospect.isQualified
        && !await getLatestResearchBriefDoc(ctx, prospect.id)
      ) {
        qualifiedWithoutResearchBrief.push({
          prospectId: prospect.id,
          fullName: prospect.fullName,
          title: prospect.title ?? null,
          qualifiedAt: toIso(prospect.qualifiedAt ?? null),
          updatedAt: toIso(prospect.updatedAt),
        });
      }
    }

    return {
      staleMinutes,
      prospectCount: prospects.length,
      noisyTitleProspects,
      staleCaptureSignalProspects,
      qualifiedWithoutResearchBrief,
    };
  },
});

export const getProspectDashboardRow = query({
  args: {
    prospectId: v.string(),
  },
  handler: async (ctx, args) => {
    const prospect = await getProspectDocById(ctx, args.prospectId);
    return prospect ? mapProspectDashboardRow(prospect) : null;
  },
});

export const inspectFreshProspectLifecycle = internalQuery({
  args: {
    since: v.number(),
    limit: v.optional(v.number()),
    marker: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [signals, prospects, threads, researchBriefs, auditEvents, workflowCheckpoints] = await Promise.all([
      ctx.db.query("signals").collect(),
      ctx.db.query("prospects").collect(),
      ctx.db.query("threads").collect(),
      ctx.db.query("researchBriefs").collect(),
      ctx.db.query("auditEvents").collect(),
      ctx.db.query("workflowCheckpoints").collect(),
    ]);

    const matchingSignals = signals
      .filter((signal) => signal.capturedAt >= args.since)
      .filter((signal) =>
        args.marker
          ? signal.metadata?.validationMarker === args.marker
          : true,
      )
      .sort((a, b) => b.capturedAt - a.capturedAt);
    const allowedSignalIds = new Set(matchingSignals.map((signal) => signal.id));

    const researchByProspectId = new Map<string, any[]>();
    for (const brief of researchBriefs) {
      const list = researchByProspectId.get(brief.prospectId) ?? [];
      list.push(brief);
      researchByProspectId.set(brief.prospectId, list);
    }

    const threadByProspectId = new Map(threads.map((thread) => [thread.prospectId, thread]));
    const auditByProspectId = new Map<string, any[]>();
    const checkpointsByProspectId = new Map<string, any[]>();
    for (const event of auditEvents) {
      if (event.entityType !== "prospect") {
        continue;
      }
      const list = auditByProspectId.get(event.entityId) ?? [];
      list.push(event);
      auditByProspectId.set(event.entityId, list);
    }
    for (const checkpoint of workflowCheckpoints) {
      if (checkpoint.entityType !== "prospect") {
        continue;
      }
      const list = checkpointsByProspectId.get(checkpoint.entityId) ?? [];
      list.push(checkpoint);
      checkpointsByProspectId.set(checkpoint.entityId, list);
    }

    const rows = prospects
      .filter((prospect) =>
        (prospect.sourceSignalId && allowedSignalIds.has(prospect.sourceSignalId))
        || prospect.updatedAt >= args.since,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, args.limit ?? 25)
      .map((prospect) => {
        const signal = prospect.sourceSignalId
          ? matchingSignals.find((item) => item.id === prospect.sourceSignalId) ?? null
          : null;
        const research = [...(researchByProspectId.get(prospect.id) ?? [])]
          .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
        const thread = threadByProspectId.get(prospect.id) ?? null;
        const checkpoints = checkpointsByProspectId.get(prospect.id) ?? [];
        const audit = auditByProspectId.get(prospect.id) ?? [];
        const workflowFailure = summarizeWorkflowFailure({
          checkpoints,
          auditEvents: audit,
        });

        return {
          prospectId: prospect.id,
          fullName: prospect.fullName,
          company: prospect.company ?? null,
          title: prospect.title ?? null,
          stage: prospect.stage,
          status: prospect.status,
          pausedReason: prospect.pausedReason ?? null,
          isQualified: Boolean(prospect.isQualified),
          qualificationSummary: typeof prospect.qualification?.summary === "string"
            ? prospect.qualification.summary
            : null,
          hasResearchBrief: Boolean(research),
          researchBriefCreatedAt: research ? toIso(research.createdAt) : null,
          workflowFailure,
          updatedAt: toIso(prospect.updatedAt),
          signal: signal
            ? {
                signalId: signal.id,
                source: signal.source,
                url: signal.url,
                topic: signal.topic,
                authorTitle: signal.authorTitle ?? null,
                capturedAt: toIso(signal.capturedAt),
                marker: typeof signal.metadata?.validationMarker === "string"
                  ? signal.metadata.validationMarker
                  : null,
              }
            : null,
          thread: thread
            ? {
                threadId: thread.id,
                stage: thread.stage,
                status: thread.status,
                pausedReason: thread.pausedReason ?? null,
                updatedAt: toIso(thread.updatedAt),
              }
            : null,
        };
      });

    return {
      since: toIso(args.since),
      marker: args.marker ?? null,
      signalsMatched: matchingSignals.length,
      prospectsMatched: rows.length,
      rows,
    };
  },
});

export const auditStaleProspectData = internalQuery({
  args: {
    before: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const [signals, prospects, threads, researchBriefs, auditEvents, workflowCheckpoints] = await Promise.all([
      ctx.db.query("signals").collect(),
      ctx.db.query("prospects").collect(),
      ctx.db.query("threads").collect(),
      ctx.db.query("researchBriefs").collect(),
      ctx.db.query("auditEvents").collect(),
      ctx.db.query("workflowCheckpoints").collect(),
    ]);

    const signalById = new Map(signals.map((signal) => [signal.id, signal]));
    const threadByProspectId = new Map(threads.map((thread) => [thread.prospectId, thread]));
    const researchByProspectId = new Map<string, any[]>();
    for (const brief of researchBriefs) {
      const list = researchByProspectId.get(brief.prospectId) ?? [];
      list.push(brief);
      researchByProspectId.set(brief.prospectId, list);
    }
    const auditByProspectId = new Map<string, any[]>();
    const checkpointsByProspectId = new Map<string, any[]>();
    for (const event of auditEvents) {
      if (event.entityType !== "prospect") {
        continue;
      }
      const list = auditByProspectId.get(event.entityId) ?? [];
      list.push(event);
      auditByProspectId.set(event.entityId, list);
    }
    for (const checkpoint of workflowCheckpoints) {
      if (checkpoint.entityType !== "prospect") {
        continue;
      }
      const list = checkpointsByProspectId.get(checkpoint.entityId) ?? [];
      list.push(checkpoint);
      checkpointsByProspectId.set(checkpoint.entityId, list);
    }

    const limitedProspects = prospects
      .filter((prospect) => prospect.updatedAt <= args.before)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, args.limit ?? prospects.length);

    const badTitleProspects = limitedProspects
      .filter((prospect) => looksLikeNoisyProspectTitle(prospect.title))
      .map((prospect) => {
        const signal = prospect.sourceSignalId ? signalById.get(prospect.sourceSignalId) ?? null : null;
        return {
          prospectId: prospect.id,
          fullName: prospect.fullName,
          currentTitle: prospect.title ?? null,
          proposedTitle: sanitizeProspectTitle(signal?.authorTitle ?? null),
          sourceSignalId: prospect.sourceSignalId ?? null,
          signalAuthorTitle: signal?.authorTitle ?? null,
          updatedAt: toIso(prospect.updatedAt),
        };
      });

    const stuckCaptureSignalProspects = limitedProspects
      .filter((prospect) =>
        prospect.stage === "capture_signal"
        && !prospect.isQualified
        && (researchByProspectId.get(prospect.id)?.length ?? 0) === 0,
      )
      .map((prospect) => {
        const thread = threadByProspectId.get(prospect.id) ?? null;
        return {
          prospectId: prospect.id,
          fullName: prospect.fullName,
          status: prospect.status,
          pausedReason: prospect.pausedReason ?? null,
          threadStatus: thread?.status ?? null,
          threadPausedReason: thread?.pausedReason ?? null,
          sourceSignalId: prospect.sourceSignalId ?? null,
          updatedAt: toIso(prospect.updatedAt),
          workflowFailure: summarizeWorkflowFailure({
            checkpoints: checkpointsByProspectId.get(prospect.id),
            auditEvents: auditByProspectId.get(prospect.id),
          }),
        };
      });

    const missingResearchBriefProspects = limitedProspects
      .filter((prospect) =>
        prospect.stage !== "capture_signal"
        && (prospect.isQualified || prospect.stage === "build_research_brief" || prospect.stage === "qualify")
        && (researchByProspectId.get(prospect.id)?.length ?? 0) === 0,
      )
      .map((prospect) => ({
        prospectId: prospect.id,
        fullName: prospect.fullName,
        stage: prospect.stage,
        status: prospect.status,
        pausedReason: prospect.pausedReason ?? null,
        updatedAt: toIso(prospect.updatedAt),
        workflowFailure: summarizeWorkflowFailure({
          checkpoints: checkpointsByProspectId.get(prospect.id),
          auditEvents: auditByProspectId.get(prospect.id),
        }),
      }));

    return {
      before: toIso(args.before),
      summary: {
        badTitles: badTitleProspects.length,
        stuckCaptureSignal: stuckCaptureSignalProspects.length,
        missingResearchBrief: missingResearchBriefProspects.length,
      },
      candidates: {
        badTitleProspects,
        stuckCaptureSignalProspects,
        missingResearchBriefProspects,
      },
    };
  },
});

export const listQualifiedLeads = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const prospects = (await ctx.db.query("prospects").collect())
      .filter((item) => item.isQualified)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, args.limit ?? 20);

    const results = [];
    for (const prospect of prospects) {
      const [thread, email, research] = await Promise.all([
        getThreadDocByProspectId(ctx, prospect.id),
        getBestContactEmailDoc(ctx, prospect.id),
        getLatestResearchBriefDoc(ctx, prospect.id),
      ]);

      results.push({
        prospectId: prospect.id,
        fullName: prospect.fullName,
        company: prospect.company ?? null,
        title: prospect.title ?? null,
        qualificationReason: prospect.qualificationReason ?? null,
        qualification: mapQualification(prospect.qualification),
        threadStatus: thread?.status ?? "active",
        researchConfidence: research ? Number(research.confidence) : null,
        email: email?.value ?? null,
        emailConfidence: email ? Number(email.confidence) : null,
        updatedAt: new Date(prospect.updatedAt).toISOString(),
      });
    }

    return results;
  },
});

export const listActiveThreads = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const threads = (await ctx.db.query("threads").collect())
      .filter((item) => item.status === "active" || item.status === "paused")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, args.limit ?? 20);

    const results = [];
    for (const thread of threads) {
      const prospect = await getProspectDocById(ctx, thread.prospectId);
      if (!prospect) {
        continue;
      }
      results.push({
        threadId: thread.id,
        prospectId: prospect.id,
        fullName: prospect.fullName,
        company: prospect.company ?? null,
        title: prospect.title ?? null,
        linkedinUrl: prospect.linkedinUrl ?? null,
        twitterUrl: prospect.twitterUrl ?? null,
        stage: thread.stage,
        status: thread.status,
        qualificationReason: prospect.qualificationReason ?? null,
        qualification: mapQualification(prospect.qualification),
        pausedReason: thread.pausedReason ?? prospect.pausedReason ?? null,
        nextFollowUpAt: thread.nextFollowUpAt ?? null,
        updatedAt: new Date(prospect.updatedAt).toISOString(),
      });
    }

    return results;
  },
});

export const listRecentProviderRuns = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const runs = (await ctx.db.query("providerRuns").collect())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 20);

    return runs.map((row) => ({
      id: row.id,
      provider: row.provider,
      kind: row.kind,
      externalId: row.externalId ?? null,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      durationMs: ["succeeded", "failed", "aborted", "timed_out", "completed"].includes(row.status)
        ? Math.max(0, row.updatedAt - row.createdAt)
        : null,
      requestTerm: typeof row.requestPayload?.term === "string" ? row.requestPayload.term : null,
      error: typeof row.responsePayload?.error === "string" ? row.responsePayload.error : null,
    }));
  },
});

export const listRecentAuditEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const events = (await ctx.db.query("auditEvents").collect())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 30);

    return events.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      eventName: row.eventName,
      payload: row.payload ?? {},
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  },
});

export const listAuditEventsForEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_entity", (q: any) => q.eq("entityType", args.entityType).eq("entityId", args.entityId))
      .collect();

    return [...rows]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 20)
      .map((row) => ({
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        eventName: row.eventName,
        payload: row.payload ?? {},
        createdAt: new Date(row.createdAt).toISOString(),
      }));
  },
});

export const findWorkflowProspectMatches = query({
  args: {
    companyDomain: v.optional(nullableString),
    companyName: v.optional(nullableString),
    email: v.optional(nullableString),
    linkedinUrl: v.optional(nullableString),
    twitterUrl: v.optional(nullableString),
    fullName: v.optional(nullableString),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const companyDomain = normalizeDomain(args.companyDomain);
    const companyName = args.companyName?.trim().toLowerCase() || null;
    const email = args.email?.trim().toLowerCase() || null;
    const linkedinUrl = args.linkedinUrl?.trim().toLowerCase() || null;
    const twitterUrl = args.twitterUrl?.trim().toLowerCase() || null;
    const fullName = args.fullName?.trim() || null;
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));

    if (!companyDomain && !companyName && !email && !linkedinUrl && !twitterUrl && !fullName) {
      return [];
    }

    const threads = (await ctx.db.query("threads").collect())
      .filter((thread) => thread.status === "active" || thread.status === "paused");

    const results = [];
    for (const thread of threads) {
      const prospect = await getProspectDocById(ctx, thread.prospectId);
      if (!prospect) {
        continue;
      }
      const bestEmail = await getBestContactEmailDoc(ctx, prospect.id);
      const matched =
        (companyDomain && normalizeDomain(prospect.companyDomain) === companyDomain)
        || (email && (bestEmail?.value?.trim().toLowerCase() || null) === email)
        || (linkedinUrl && (prospect.linkedinUrl?.trim().toLowerCase() || null) === linkedinUrl)
        || (twitterUrl && (prospect.twitterUrl?.trim().toLowerCase() || null) === twitterUrl)
        || (
          fullName
          && prospect.fullName === fullName
          && (
            !companyDomain
            || normalizeDomain(prospect.companyDomain) === companyDomain
            || (prospect.company?.trim().toLowerCase() || null) === companyName
          )
        );

      if (!matched) {
        continue;
      }

      results.push({
        prospectId: prospect.id,
        threadId: thread.id,
        fullName: prospect.fullName,
        company: prospect.company ?? null,
        companyDomain: prospect.companyDomain ?? null,
        linkedinUrl: prospect.linkedinUrl ?? null,
        twitterUrl: prospect.twitterUrl ?? null,
        email: bestEmail?.value ?? null,
        stage: thread.stage,
        status: thread.status,
        updatedAt: new Date(prospect.updatedAt).toISOString(),
      });
    }

    return results
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);
  },
});

export const recordProviderRun = mutation({
  args: {
    provider: v.string(),
    kind: v.string(),
    externalId: v.optional(nullableString),
    status: v.string(),
    requestPayload: v.optional(v.any()),
    responsePayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const id = makeId("prun");
    const timestamp = now();
    await ctx.db.insert("providerRuns", {
      id,
      provider: args.provider,
      kind: args.kind,
      externalId: args.externalId ?? null,
      status: args.status,
      requestPayload: args.requestPayload ?? {},
      responsePayload: args.responsePayload ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return id;
  },
});

export const updateProviderRun = mutation({
  args: {
    id: v.string(),
    status: v.string(),
    responsePayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("providerRuns").withIndex("by_provider_run_id", (q: any) => q.eq("id", args.id)).unique();
    if (!existing) {
      throw new Error(`provider run ${args.id} not found`);
    }

    await ctx.db.patch(existing._id, {
      status: args.status,
      responsePayload: args.responsePayload ?? {},
      updatedAt: now(),
    });
  },
});

export const insertSignal = mutation({
  args: signalInsertInput,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("signals")
      .withIndex("by_source_source_ref", (q: any) => q.eq("source", args.source).eq("sourceRef", args.sourceRef))
      .unique();

    const patch = {
      id: existing?.id ?? args.id,
      campaignId: args.campaignId,
      source: args.source,
      sourceRef: args.sourceRef,
      actorRunId: args.actorRunId ?? null,
      datasetId: args.datasetId ?? null,
      url: args.url,
      authorName: args.authorName,
      authorTitle: args.authorTitle ?? null,
      authorCompany: args.authorCompany ?? null,
      companyDomain: normalizeDomain(args.companyDomain),
      twitterUrl: args.twitterUrl ?? null,
      topic: args.topic,
      content: args.content,
      metadata: args.metadata ?? {},
      capturedAt: args.capturedAt,
      updatedAt: now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing.id;
    }

    await ctx.db.insert("signals", {
      ...patch,
      provider: undefined,
      externalId: undefined,
      localSignalId: undefined,
      createdAt: now(),
    });
    return args.id;
  },
});

export const getSignal = query({
  args: {
    signalId: v.string(),
  },
  handler: async (ctx, args) => mapSignal(await getSignalDocById(ctx, args.signalId)),
});

export const createOrUpdateProspectFromSignal = mutation({
  args: {
    signalId: v.string(),
    campaignId: v.string(),
  },
  handler: async (ctx, args) => {
    const signal = await getSignalDocById(ctx, args.signalId);
    if (!signal) {
      throw new Error(`signal ${args.signalId} not found`);
    }

    const companyDomain = normalizeDomain(signal.companyDomain);
    let accountId: string | null = null;
    if (companyDomain) {
      const existingAccount = await ctx.db.query("accounts").withIndex("by_domain", (q: any) => q.eq("domain", companyDomain)).unique();
      if (existingAccount) {
        accountId = existingAccount.id;
      } else {
        accountId = makeId("acct");
        const timestamp = now();
        await ctx.db.insert("accounts", {
          id: accountId,
          domain: companyDomain,
          name: signal.authorCompany ?? signal.companyDomain ?? "Unknown",
          metadata: {},
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    const linkedinProfileUrl = extractLinkedinProfileUrl(signal.metadata, signal.url);
    const twitterProfileUrl = signal.twitterUrl ?? extractTwitterProfileUrl(signal.metadata, signal.url);
    let existingProspect = (await ctx.db.query("prospects").withIndex("by_source_signal", (q: any) => q.eq("sourceSignalId", signal.id)).collect())[0] ?? null;

    if (!existingProspect && linkedinProfileUrl) {
      existingProspect = await ctx.db
        .query("prospects")
        .withIndex("by_campaign_linkedin", (q: any) => q.eq("campaignId", args.campaignId).eq("linkedinUrl", linkedinProfileUrl))
        .unique();
    }
    if (!existingProspect && twitterProfileUrl) {
      existingProspect = await ctx.db
        .query("prospects")
        .withIndex("by_campaign_twitter", (q: any) => q.eq("campaignId", args.campaignId).eq("twitterUrl", twitterProfileUrl))
        .unique();
    }
    if (!existingProspect) {
      existingProspect = await ctx.db
        .query("prospects")
        .withIndex("by_campaign_name_domain", (q: any) =>
          q.eq("campaignId", args.campaignId).eq("fullName", signal.authorName).eq("companyDomain", companyDomain))
        .unique();
    }

    const prospectId = existingProspect?.id ?? makeId("pros");
    const threadId = existingProspect
      ? ((await getThreadDocByProspectId(ctx, prospectId))?.id ?? makeId("thr"))
      : makeId("thr");
    const timestamp = now();
    const companyResearchUrl = extractCompanyResearchUrl({
      metadata: signal.metadata,
      companyDomain,
    });

    const prospectPatch = {
      id: prospectId,
      campaignId: args.campaignId,
      accountId,
      fullName: signal.authorName,
      firstName: signal.authorName.split(/\s+/)[0] ?? signal.authorName,
      title: signal.authorTitle ?? null,
      company: signal.authorCompany ?? null,
      companyDomain,
      linkedinUrl: linkedinProfileUrl,
      twitterUrl: twitterProfileUrl,
      attioCompanyRecordId: existingProspect?.attioCompanyRecordId ?? null,
      attioPersonRecordId: existingProspect?.attioPersonRecordId ?? null,
      attioListEntryId: existingProspect?.attioListEntryId ?? null,
      sourceSignalId: signal.id,
      qualificationReason: existingProspect?.qualificationReason ?? null,
      qualification: existingProspect?.qualification,
      metadata: {
        ...(existingProspect?.metadata ?? {}),
        signalTopic: signal.topic,
        companyResearchUrl,
      },
      isQualified: existingProspect?.isQualified ?? false,
      qualifiedAt: existingProspect?.qualifiedAt ?? null,
      status: existingProspect?.status ?? "active",
      stage: existingProspect?.stage ?? "capture_signal",
      lastReplyClass: existingProspect?.lastReplyClass ?? null,
      pausedReason: existingProspect?.pausedReason ?? null,
      updatedAt: timestamp,
    };

    if (existingProspect) {
      await ctx.db.patch(existingProspect._id, prospectPatch);
    } else {
      await ctx.db.insert("prospects", {
        ...prospectPatch,
        createdAt: timestamp,
      });
    }

    const existingThread = await getThreadDocByProspectId(ctx, prospectId);
    if (existingThread) {
      await ctx.db.patch(existingThread._id, { updatedAt: timestamp });
    } else {
      await ctx.db.insert("threads", {
        id: threadId,
        prospectId,
        campaignId: args.campaignId,
        stage: "capture_signal",
        status: "active",
        lastReplyClass: null,
        pausedReason: null,
        providerThreadId: null,
        providerInboxId: null,
        nextFollowUpAt: null,
        metadata: {},
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return {
      prospectId,
      threadId: existingThread?.id ?? threadId,
    };
  },
});

export const getProspectSnapshot = query({
  args: {
    prospectId: v.string(),
  },
  handler: async (ctx, args) => {
    const prospect = await getProspectDocById(ctx, args.prospectId);
    if (!prospect) {
      throw new Error(`prospect ${args.prospectId} not found`);
    }
    const [thread, campaign, email, researchBrief, messages] = await Promise.all([
      getThreadDocByProspectId(ctx, prospect.id),
      getCampaignDocById(ctx, prospect.campaignId),
      getBestContactEmailDoc(ctx, prospect.id),
      getLatestResearchBriefDoc(ctx, prospect.id),
      (async () => {
        const threadDoc = await getThreadDocByProspectId(ctx, prospect.id);
        return threadDoc ? getMessagesForThread(ctx, threadDoc.id) : [];
      })(),
    ]);

    if (!thread || !campaign) {
      throw new Error(`prospect snapshot for ${args.prospectId} is incomplete`);
    }

    return {
      prospect: {
        prospectId: prospect.id,
        accountId: prospect.accountId ?? null,
        campaignId: prospect.campaignId,
        fullName: prospect.fullName,
        firstName: prospect.firstName,
        title: prospect.title ?? null,
        company: prospect.company ?? null,
        companyDomain: prospect.companyDomain ?? null,
        linkedinUrl: prospect.linkedinUrl ?? null,
        twitterUrl: prospect.twitterUrl ?? null,
        attioCompanyRecordId: prospect.attioCompanyRecordId ?? null,
        attioPersonRecordId: prospect.attioPersonRecordId ?? null,
        attioListEntryId: prospect.attioListEntryId ?? null,
        sourceSignalId: prospect.sourceSignalId ?? null,
        status: prospect.status,
        stage: prospect.stage,
        lastReplyClass: prospect.lastReplyClass ?? null,
        pausedReason: prospect.pausedReason ?? null,
      },
      qualificationReason: prospect.qualificationReason ?? null,
      qualification: mapQualification(prospect.qualification),
      campaign: mapCampaign(campaign),
      thread: {
        id: thread.id,
        stage: thread.stage,
        status: thread.status,
        lastReplyClass: thread.lastReplyClass ?? null,
        pausedReason: thread.pausedReason ?? null,
        nextFollowUpAt: thread.nextFollowUpAt ?? null,
        providerThreadId: thread.providerThreadId ?? null,
        providerInboxId: thread.providerInboxId ?? null,
      },
      email: email
        ? {
          address: email.value,
          confidence: Number(email.confidence),
          source: email.source,
        }
        : null,
      researchBrief: researchBrief
        ? {
          id: researchBrief.id,
          prospectId: researchBrief.prospectId,
          campaignId: researchBrief.campaignId,
          summary: researchBrief.summary,
          copyGuidance: researchBrief.metadata?.copyGuidance ?? null,
          evidence: Array.isArray(researchBrief.evidence) ? researchBrief.evidence : [],
          confidence: Number(researchBrief.confidence),
          createdAt: researchBrief.createdAt,
        }
        : null,
      messages: messages.map((row) => ({
        id: row.id,
        direction: row.direction,
        kind: row.kind,
        subject: row.subject ?? null,
        bodyText: row.bodyText,
        classification: row.classification ?? null,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
    };
  },
});

export const getProspectIdByProviderThreadId = query({
  args: {
    providerThreadId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_provider_thread", (q: any) => q.eq("providerThreadId", args.providerThreadId))
      .unique();

    return thread ? { prospectId: thread.prospectId, threadId: thread.id } : null;
  },
});

export const getBestContactEmail = query({
  args: {
    prospectId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await getBestContactEmailDoc(ctx, args.prospectId);
    return row
      ? {
        address: row.value,
        confidence: Number(row.confidence),
        source: row.source,
      }
      : null;
  },
});

export const upsertContactEmail = mutation({
  args: {
    prospectId: v.string(),
    email: v.object({
      address: v.string(),
      confidence: v.number(),
      source: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contactMethods")
      .withIndex("by_prospect_kind_value", (q: any) =>
        q.eq("prospectId", args.prospectId).eq("kind", "email").eq("value", args.email.address))
      .unique();

    const timestamp = now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        confidence: args.email.confidence,
        source: args.email.source,
        verified: args.email.confidence >= 0.75,
        updatedAt: timestamp,
      });
      return existing.id;
    }

    const id = makeId("cm");
    await ctx.db.insert("contactMethods", {
      id,
      prospectId: args.prospectId,
      kind: "email",
      value: args.email.address,
      confidence: args.email.confidence,
      source: args.email.source,
      verified: args.email.confidence >= 0.75,
      metadata: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return id;
  },
});

export const saveResearchBrief = mutation({
  args: {
    prospectId: v.string(),
    campaignId: v.string(),
    summary: v.string(),
    copyGuidance: v.optional(v.any()),
    evidence: v.any(),
    confidence: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const id = makeId("brief");
    await ctx.db.insert("researchBriefs", {
      id,
      prospectId: args.prospectId,
      campaignId: args.campaignId,
      summary: args.summary,
      evidence: args.evidence,
      confidence: args.confidence,
      metadata: {
        ...(args.metadata ?? {}),
        copyGuidance: args.copyGuidance ?? null,
      },
      createdAt: now(),
    });
    return id;
  },
});

export const getLatestResearchBrief = query({
  args: {
    prospectId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await getLatestResearchBriefDoc(ctx, args.prospectId);
    return row
      ? {
        id: row.id,
        prospectId: row.prospectId,
        campaignId: row.campaignId,
        summary: row.summary,
        copyGuidance: row.metadata?.copyGuidance ?? null,
        evidence: Array.isArray(row.evidence) ? row.evidence : [],
        confidence: Number(row.confidence),
        createdAt: row.createdAt,
      }
      : null;
  },
});

export const listMessages = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await getMessagesForThread(ctx, args.threadId);
    return rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      kind: row.kind,
      subject: row.subject ?? null,
      bodyText: row.bodyText,
      classification: row.classification ?? null,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
  },
});

export const addMessage = mutation({
  args: messageInsertInput,
  handler: async (ctx, args) => {
    const id = makeId("msg");
    await ctx.db.insert("messages", {
      id,
      threadId: args.threadId,
      providerMessageId: args.providerMessageId ?? null,
      direction: args.direction,
      kind: args.kind,
      subject: args.subject ?? null,
      bodyText: args.bodyText,
      bodyHtml: args.bodyHtml ?? null,
      classification: args.classification ?? null,
      metadata: args.metadata ?? {},
      createdAt: now(),
    });
    return id;
  },
});

export const updateThreadState = mutation({
  args: {
    threadId: v.string(),
    stage: v.optional(v.string()),
    status: v.optional(v.string()),
    lastReplyClass: v.optional(nullableString),
    pausedReason: v.optional(nullableString),
    providerThreadId: v.optional(nullableString),
    providerInboxId: v.optional(nullableString),
    nextFollowUpAt: v.optional(nullableString),
  },
  handler: async (ctx, args) => {
    const thread = await getThreadDocById(ctx, args.threadId);
    if (!thread) {
      throw new Error(`thread ${args.threadId} not found`);
    }

    await ctx.db.patch(thread._id, {
      ...(args.stage !== undefined ? { stage: args.stage } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.lastReplyClass !== undefined ? { lastReplyClass: args.lastReplyClass } : {}),
      ...(args.pausedReason !== undefined ? { pausedReason: args.pausedReason } : {}),
      ...(args.providerThreadId !== undefined ? { providerThreadId: args.providerThreadId } : {}),
      ...(args.providerInboxId !== undefined ? { providerInboxId: args.providerInboxId } : {}),
      ...(args.nextFollowUpAt !== undefined ? { nextFollowUpAt: args.nextFollowUpAt } : {}),
      updatedAt: now(),
    });
  },
});

export const updateProspectState = mutation({
  args: {
    prospectId: v.string(),
    stage: v.optional(v.string()),
    status: v.optional(v.string()),
    lastReplyClass: v.optional(nullableString),
    pausedReason: v.optional(nullableString),
  },
  handler: async (ctx, args) => {
    const prospect = await getProspectDocById(ctx, args.prospectId);
    if (!prospect) {
      throw new Error(`prospect ${args.prospectId} not found`);
    }

    await ctx.db.patch(prospect._id, {
      ...(args.stage !== undefined ? { stage: args.stage } : {}),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.lastReplyClass !== undefined ? { lastReplyClass: args.lastReplyClass } : {}),
      ...(args.pausedReason !== undefined ? { pausedReason: args.pausedReason } : {}),
      updatedAt: now(),
    });
  },
});

export const updateProspectCrmReferences = mutation({
  args: {
    prospectId: v.string(),
    attioCompanyRecordId: v.optional(nullableString),
    attioPersonRecordId: v.optional(nullableString),
    attioListEntryId: v.optional(nullableString),
  },
  handler: async (ctx, args) => {
    const prospect = await getProspectDocById(ctx, args.prospectId);
    if (!prospect) {
      throw new Error(`prospect ${args.prospectId} not found`);
    }

    await ctx.db.patch(prospect._id, {
      ...(args.attioCompanyRecordId !== undefined ? { attioCompanyRecordId: args.attioCompanyRecordId } : {}),
      ...(args.attioPersonRecordId !== undefined ? { attioPersonRecordId: args.attioPersonRecordId } : {}),
      ...(args.attioListEntryId !== undefined ? { attioListEntryId: args.attioListEntryId } : {}),
      updatedAt: now(),
    });
  },
});

export const applyQualificationAssessment = mutation({
  args: {
    prospectId: v.string(),
    assessment: qualificationAssessment,
  },
  handler: async (ctx, args) => {
    const prospect = await getProspectDocById(ctx, args.prospectId);
    if (!prospect) {
      throw new Error(`prospect ${args.prospectId} not found`);
    }

    await ctx.db.patch(prospect._id, {
      isQualified: args.assessment.ok,
      qualifiedAt: args.assessment.ok ? (prospect.qualifiedAt ?? now()) : null,
      qualificationReason: args.assessment.reason,
      qualification: args.assessment,
      metadata: {
        ...(prospect.metadata ?? {}),
        qualification: args.assessment,
      },
      updatedAt: now(),
    });
  },
});

export const pauseThread = mutation({
  args: {
    threadId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await getThreadDocById(ctx, args.threadId);
    if (!thread) {
      throw new Error(`thread ${args.threadId} not found`);
    }

    await ctx.db.patch(thread._id, {
      status: "paused",
      pausedReason: args.reason,
      updatedAt: now(),
    });

    const prospect = await getProspectDocById(ctx, thread.prospectId);
    if (prospect) {
      await ctx.db.patch(prospect._id, {
        status: "paused",
        pausedReason: args.reason,
        updatedAt: now(),
      });
    }
  },
});

export const applyStaleProspectMaintenance = internalMutation({
  args: {
    prospectIds: v.array(v.string()),
    normalizeTitles: v.boolean(),
    pauseStuckCaptureSignal: v.boolean(),
    pauseMissingResearchBrief: v.boolean(),
    pauseReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const pauseReason = args.pauseReason?.trim() || "stale_pre_fix_cleanup";
    const results: Array<Record<string, unknown>> = [];

    for (const prospectId of args.prospectIds) {
      const prospect = await getProspectDocById(ctx, prospectId);
      if (!prospect) {
        results.push({
          prospectId,
          updated: false,
          reason: "prospect_not_found",
        });
        continue;
      }

      const [thread, signal, researchBrief] = await Promise.all([
        getThreadDocByProspectId(ctx, prospect.id),
        prospect.sourceSignalId ? getSignalDocById(ctx, prospect.sourceSignalId) : Promise.resolve(null),
        getLatestResearchBriefDoc(ctx, prospect.id),
      ]);

      const updatedFields: string[] = [];

      if (args.normalizeTitles && looksLikeNoisyProspectTitle(prospect.title)) {
        const repairedTitle = sanitizeProspectTitle(signal?.authorTitle ?? null);
        await ctx.db.patch(prospect._id, {
          title: repairedTitle,
          updatedAt: now(),
        });
        await ctx.db.insert("auditEvents", {
          id: makeId("audit"),
          entityType: "prospect",
          entityId: prospect.id,
          eventName: "MaintenanceTitleNormalized",
          payload: {
            from: prospect.title ?? null,
            to: repairedTitle,
            sourceSignalId: prospect.sourceSignalId ?? null,
          },
          createdAt: now(),
        });
        updatedFields.push("title");
      }

      const isStuckCaptureSignal =
        prospect.stage === "capture_signal"
        && !prospect.isQualified
        && !researchBrief;
      const isMissingResearchBrief =
        prospect.stage !== "capture_signal"
        && (prospect.isQualified || prospect.stage === "build_research_brief" || prospect.stage === "qualify")
        && !researchBrief;

      if (
        (args.pauseStuckCaptureSignal && isStuckCaptureSignal)
        || (args.pauseMissingResearchBrief && isMissingResearchBrief)
      ) {
        await ctx.db.patch(prospect._id, {
          status: "paused",
          pausedReason: pauseReason,
          updatedAt: now(),
        });
        if (thread) {
          await ctx.db.patch(thread._id, {
            status: "paused",
            pausedReason: pauseReason,
            updatedAt: now(),
          });
        }
        await ctx.db.insert("auditEvents", {
          id: makeId("audit"),
          entityType: "prospect",
          entityId: prospect.id,
          eventName: "MaintenanceLifecyclePaused",
          payload: {
            pauseReason,
            stage: prospect.stage,
            hadResearchBrief: Boolean(researchBrief),
            category: isStuckCaptureSignal ? "stuck_capture_signal" : "missing_research_brief",
          },
          createdAt: now(),
        });
        updatedFields.push("status");
      }

      results.push({
        prospectId: prospect.id,
        updated: updatedFields.length > 0,
        updatedFields,
      });
    }

    return {
      ok: true,
      results,
      summary: {
        touched: results.filter((item) => item.updated === true).length,
        titleNormalized: results.filter((item) =>
          Array.isArray(item.updatedFields) && item.updatedFields.includes("title"),
        ).length,
        paused: results.filter((item) =>
          Array.isArray(item.updatedFields) && item.updatedFields.includes("status"),
        ).length,
      },
    };
  },
});

export const cleanupDataQuality = mutation({
  args: {
    limit: v.optional(v.number()),
    staleMinutes: v.optional(v.number()),
    pauseReason: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 250));
    const staleMinutes = Math.max(5, args.staleMinutes ?? 90);
    const staleCutoff = now() - (staleMinutes * 60 * 1000);
    const pauseReason = args.pauseReason ?? "stale capture_signal cleanup";
    const dryRun = args.dryRun ?? true;
    const prospects = (await ctx.db.query("prospects").collect())
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const titleFixes: Array<Record<string, unknown>> = [];
    const pausedProspects: Array<Record<string, unknown>> = [];

    for (const prospect of prospects) {
      if (titleFixes.length < limit && isNoisyProspectTitle(prospect.title ?? null)) {
        const signal = prospect.sourceSignalId ? await getSignalDocById(ctx, prospect.sourceSignalId) : null;
        const replacementTitle = normalizeProspectTitleCandidate(signal?.authorTitle ?? null);
        titleFixes.push({
          prospectId: prospect.id,
          from: prospect.title ?? null,
          to: replacementTitle,
        });
        if (!dryRun) {
          await ctx.db.patch(prospect._id, {
            title: replacementTitle,
            updatedAt: now(),
          });
        }
      }

      if (
        pausedProspects.length < limit
        && prospect.stage === "capture_signal"
        && prospect.status === "active"
        && !prospect.qualification
        && prospect.updatedAt <= staleCutoff
      ) {
        const thread = await getThreadDocByProspectId(ctx, prospect.id);
        pausedProspects.push({
          prospectId: prospect.id,
          threadId: thread?.id ?? null,
          reason: pauseReason,
        });
        if (!dryRun) {
          await ctx.db.patch(prospect._id, {
            status: "paused",
            pausedReason: pauseReason,
            updatedAt: now(),
          });
          if (thread) {
            await ctx.db.patch(thread._id, {
              status: "paused",
              pausedReason: pauseReason,
              updatedAt: now(),
            });
          }
        }
      }
    }

    return {
      dryRun,
      staleMinutes,
      normalizedTitles: titleFixes,
      pausedCaptureSignalProspects: pausedProspects,
    };
  },
});

export const createHandoff = mutation({
  args: {
    threadId: v.string(),
    target: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const id = makeId("handoff");
    const timestamp = now();
    await ctx.db.insert("handoffs", {
      id,
      threadId: args.threadId,
      target: args.target,
      payload: args.payload ?? {},
      status: "queued",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return id;
  },
});

export const markHandoffStatus = mutation({
  args: {
    handoffId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const handoff = await ctx.db.query("handoffs").withIndex("by_handoff_id", (q: any) => q.eq("id", args.handoffId)).unique();
    if (!handoff) {
      throw new Error(`handoff ${args.handoffId} not found`);
    }
    await ctx.db.patch(handoff._id, {
      status: args.status,
      updatedAt: now(),
    });
  },
});

export const appendAuditEvent = mutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    eventName: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const id = makeId("audit");
    await ctx.db.insert("auditEvents", {
      id,
      entityType: args.entityType,
      entityId: args.entityId,
      eventName: args.eventName,
      payload: args.payload ?? {},
      createdAt: now(),
    });
    return id;
  },
});

export const countOutboundMessages = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_thread_direction", (q: any) => q.eq("threadId", args.threadId).eq("direction", "outbound"))
      .collect();
    return rows.length;
  },
});

export const getLatestInboundMessage = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_thread_direction", (q: any) => q.eq("threadId", args.threadId).eq("direction", "inbound"))
      .collect();
    const row = [...rows].sort((a, b) => b.createdAt - a.createdAt)[0];
    return row
      ? {
        id: row.id,
        subject: row.subject ?? null,
        body_text: row.bodyText,
        provider_message_id: row.providerMessageId ?? null,
        created_at: new Date(row.createdAt).toISOString(),
      }
      : null;
  },
});

export const getThread = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await getThreadDocById(ctx, args.threadId);
    return thread
      ? {
        id: thread.id,
        prospect_id: thread.prospectId,
        campaign_id: thread.campaignId,
        stage: thread.stage,
        status: thread.status,
        last_reply_class: thread.lastReplyClass ?? null,
        paused_reason: thread.pausedReason ?? null,
        provider_thread_id: thread.providerThreadId ?? null,
        provider_inbox_id: thread.providerInboxId ?? null,
      }
      : null;
  },
});

export const touchThreadFollowup = mutation({
  args: {
    threadId: v.string(),
    dateIso: nullableString,
  },
  handler: async (ctx, args) => {
    const thread = await getThreadDocById(ctx, args.threadId);
    if (!thread) {
      throw new Error(`thread ${args.threadId} not found`);
    }
    await ctx.db.patch(thread._id, {
      nextFollowUpAt: args.dateIso ?? null,
      updatedAt: now(),
    });
  },
});

export const saveSandboxTranscript = mutation({
  args: {
    threadId: v.string(),
    stage: v.string(),
    transcript: v.any(),
    outputText: v.string(),
    usage: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const id = makeId("audit");
    await ctx.db.insert("auditEvents", {
      id,
      entityType: "thread",
      entityId: args.threadId,
      eventName: "SandboxTurnCompleted",
      payload: {
        stage: args.stage,
        transcript: args.transcript,
        outputText: args.outputText,
        usage: args.usage ?? {},
        storedAt: new Date().toISOString(),
      },
      createdAt: now(),
    });
    return id;
  },
});

export const getCampaignPolicyForProspect = query({
  args: {
    prospectId: v.string(),
  },
  handler: async (ctx, args) => {
    const prospect = await getProspectDocById(ctx, args.prospectId);
    if (!prospect) {
      throw new Error(`prospect ${args.prospectId} not found`);
    }
    const campaign = await getCampaignDocById(ctx, prospect.campaignId);
    if (!campaign) {
      throw new Error(`campaign for prospect ${args.prospectId} not found`);
    }
    return mapCampaign(campaign);
  },
});

function extractLinkedinProfileUrl(metadata: Record<string, unknown>, fallbackUrl: string) {
  if (typeof metadata.authorLink === "string" && metadata.authorLink.includes("linkedin.com/in/")) {
    return metadata.authorLink;
  }
  if (typeof metadata.authorProfileUrl === "string" && metadata.authorProfileUrl.includes("linkedin.com/in/")) {
    return metadata.authorProfileUrl;
  }
  if (typeof metadata.authorUrl === "string" && metadata.authorUrl.includes("linkedin.com/in/")) {
    return metadata.authorUrl;
  }
  if (fallbackUrl.includes("linkedin.com/in/")) {
    return fallbackUrl;
  }
  return null;
}

function extractTwitterProfileUrl(metadata: Record<string, unknown>, fallbackUrl: string) {
  if (typeof metadata.authorUrl === "string" && (metadata.authorUrl.includes("x.com/") || metadata.authorUrl.includes("twitter.com/"))) {
    return metadata.authorUrl;
  }
  if (fallbackUrl.includes("x.com/") || fallbackUrl.includes("twitter.com/")) {
    return fallbackUrl;
  }
  return null;
}

function extractCompanyResearchUrl(input: {
  metadata: Record<string, unknown>;
  companyDomain: string | null;
}) {
  const candidates = [
    typeof input.metadata.companyWebsite === "string" ? input.metadata.companyWebsite : null,
    typeof input.metadata.website === "string" ? input.metadata.website : null,
    input.companyDomain ? `https://${input.companyDomain}` : null,
  ];

  return candidates.find((value) => Boolean(value)) ?? null;
}
