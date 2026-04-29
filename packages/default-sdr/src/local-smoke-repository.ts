import crypto from "node:crypto";

import type {
  CampaignPolicy,
  ControlFlags,
  DashboardActiveThreadRow,
  DashboardAuditEventRow,
  DashboardProspectRow,
  DashboardProviderRunRow,
  DashboardQualifiedLeadRow,
  DashboardSignalRow,
  MessageInsertInput,
  ProspectSnapshot,
  TrellisRepositoryPort,
  WorkflowProspectMatchRow,
} from "./repository-contracts.js";
import type {
  ContactEmail,
  InternalEventName,
  ProspectContext,
  QualificationAssessment,
  ResearchBrief,
  ReplyClass,
  SignalRecord,
} from "./domain-types.js";

const DEFAULT_CAMPAIGN_ID = "cmp_default";

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeComparable(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function firstNameFromFullName(fullName: string) {
  const [first = "there"] = fullName.trim().split(/\s+/);
  return first || "there";
}

function toLinkedinProfileUrl(signal: StoredSignal) {
  if (typeof signal.metadata.linkedinProfileUrl === "string" && signal.metadata.linkedinProfileUrl.length > 0) {
    return signal.metadata.linkedinProfileUrl;
  }
  if (signal.url.includes("linkedin.com/in/")) {
    return signal.url;
  }
  return null;
}

function toTwitterProfileUrl(signal: StoredSignal) {
  if (typeof signal.metadata.twitterProfileUrl === "string" && signal.metadata.twitterProfileUrl.length > 0) {
    return signal.metadata.twitterProfileUrl;
  }
  if (signal.url.includes("x.com/") || signal.url.includes("twitter.com/")) {
    return signal.url;
  }
  return null;
}

type ProviderRunStore = DashboardProviderRunRow & {
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
};

type StoredSignal = SignalRecord & {
  campaignId: string;
  datasetId?: string | null;
};

type ProspectStore = ProspectContext & {
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  updatedAt: string;
};

type ThreadStore = {
  id: string;
  prospectId: string;
  campaignId: string;
  stage: ProspectContext["stage"];
  status: ProspectContext["status"];
  lastReplyClass: ReplyClass | null;
  pausedReason: string | null;
  nextFollowUpAt: string | null;
  providerThreadId: string | null;
  providerInboxId: string | null;
  updatedAt: string;
};

type MessageStore = {
  id: string;
  threadId: string;
  providerMessageId: string | null;
  direction: "inbound" | "outbound";
  kind: string;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  classification: ReplyClass | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type HandoffStore = {
  id: string;
  threadId: string;
  target: string;
  payload: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export class LocalSmokeRepository implements TrellisRepositoryPort {
  readonly providerId = "local-smoke";
  private campaign: CampaignPolicy;
  private controlFlags: ControlFlags = {
    globalKillSwitch: false,
    noSendsMode: false,
    pausedCampaignIds: [],
  };
  private providerRuns: ProviderRunStore[] = [];
  private signals: StoredSignal[] = [];
  private auditEvents: DashboardAuditEventRow[] = [];
  private prospects = new Map<string, ProspectStore>();
  private threads = new Map<string, ThreadStore>();
  private prospectBySignal = new Map<string, { prospectId: string; threadId: string }>();
  private prospectBySignature = new Map<string, string>();
  private researchBriefs = new Map<string, ResearchBrief[]>();
  private messages = new Map<string, MessageStore[]>();
  private emails = new Map<string, ContactEmail>();
  private handoffs = new Map<string, HandoffStore>();

  constructor(defaultCampaignTimezone: string) {
    this.campaign = {
      id: DEFAULT_CAMPAIGN_ID,
      name: "Default SDR Campaign",
      status: "active",
      timezone: defaultCampaignTimezone,
      quietHoursStart: 21,
      quietHoursEnd: 8,
      touchCap: 5,
      emailConfidenceThreshold: 0.75,
      researchConfidenceThreshold: 0.65,
      sourceLinkedinEnabled: true,
      senderEmail: null,
      senderDisplayName: null,
      senderProviderInboxId: null,
    };
  }

  ensureDefaultCampaign: TrellisRepositoryPort["ensureDefaultCampaign"] = async () => ({ ...this.campaign });

  getCampaign: TrellisRepositoryPort["getCampaign"] = async (campaignId) => {
    if (campaignId !== this.campaign.id) {
      throw new Error(`campaign ${campaignId} not found in local smoke mode`);
    }
    return { ...this.campaign };
  };

  getControlFlags: TrellisRepositoryPort["getControlFlags"] = async () => ({ ...this.controlFlags });

  setControlFlag: TrellisRepositoryPort["setControlFlag"] = async (key, value) => {
    if (key === "global_kill_switch") {
      this.controlFlags.globalKillSwitch = Boolean(value.enabled);
    }
    if (key === "no_sends_mode") {
      this.controlFlags.noSendsMode = Boolean(value.enabled);
    }
    if (key === "paused_campaigns") {
      this.controlFlags.pausedCampaignIds = Array.isArray(value.campaignIds)
        ? value.campaignIds.filter((item): item is string => typeof item === "string")
        : [];
    }
  };

  setCampaignLinkedinSource: TrellisRepositoryPort["setCampaignLinkedinSource"] = async (campaignId, enabled) => {
    if (campaignId !== this.campaign.id) {
      throw new Error(`campaign ${campaignId} not found in local smoke mode`);
    }
    this.campaign.sourceLinkedinEnabled = enabled;
  };

  setCampaignTimezone: TrellisRepositoryPort["setCampaignTimezone"] = async (campaignId, timezone) => {
    if (campaignId !== this.campaign.id) {
      throw new Error(`campaign ${campaignId} not found in local smoke mode`);
    }
    this.campaign.timezone = timezone;
  };

  updateCampaignSenderIdentity: TrellisRepositoryPort["updateCampaignSenderIdentity"] = async (input) => {
    if (input.campaignId !== this.campaign.id) {
      throw new Error(`campaign ${input.campaignId} not found in local smoke mode`);
    }
    if (input.senderEmail !== undefined) {
      this.campaign.senderEmail = input.senderEmail;
    }
    if (input.senderDisplayName !== undefined) {
      this.campaign.senderDisplayName = input.senderDisplayName;
    }
    if (input.senderProviderInboxId !== undefined) {
      this.campaign.senderProviderInboxId = input.senderProviderInboxId;
    }
  };

  getDashboardSummary: TrellisRepositoryPort["getDashboardSummary"] = async () => ({
    signals: this.signals.length,
    prospects: this.prospects.size,
    qualifiedLeads: [...this.prospects.values()].filter((prospect) => prospect.qualification?.ok).length,
    activeThreads: [...this.threads.values()].filter((thread) => thread.status === "active").length,
    pausedThreads: [...this.threads.values()].filter((thread) => thread.status === "paused").length,
    providerRuns24h: this.providerRuns.length,
    globalKillSwitch: this.controlFlags.globalKillSwitch,
    noSendsMode: this.controlFlags.noSendsMode,
  });

  listRecentSignals: TrellisRepositoryPort["listRecentSignals"] = async (limit = 20) =>
    this.signals
      .slice()
      .sort((left, right) => right.capturedAt - left.capturedAt)
      .slice(0, limit)
      .map<DashboardSignalRow>((signal) => ({
        id: signal.id,
        source: signal.source,
        topic: signal.topic,
        authorName: signal.authorName,
        authorCompany: signal.authorCompany ?? null,
        url: signal.url,
        capturedAt: new Date(signal.capturedAt).toISOString(),
      }));

  listRecentProspects: TrellisRepositoryPort["listRecentProspects"] = async (limit = 20) =>
    [...this.prospects.values()]
      .slice()
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit)
      .map((prospect) => this.toDashboardProspectRow(prospect));

  getProspectDashboardRow: TrellisRepositoryPort["getProspectDashboardRow"] = async (prospectId) => {
    const prospect = this.requireProspect(prospectId);
    return this.toDashboardProspectRow(prospect);
  };

  listQualifiedLeads: TrellisRepositoryPort["listQualifiedLeads"] = async (limit = 20) =>
    [...this.prospects.values()]
      .filter((prospect) => prospect.qualification?.ok)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit)
      .map((prospect) => {
        const thread = this.requireThreadByProspect(prospect.prospectId);
        const email = this.emails.get(prospect.prospectId) ?? null;
        const researchBrief = this.getLatestResearchBriefSync(prospect.prospectId);
        return {
          prospectId: prospect.prospectId,
          fullName: prospect.fullName,
          company: prospect.company,
          title: prospect.title,
          qualificationReason: prospect.qualificationReason,
          qualification: prospect.qualification,
          threadStatus: thread.status,
          researchConfidence: researchBrief?.confidence ?? null,
          email: email?.address ?? null,
          emailConfidence: email?.confidence ?? null,
          updatedAt: prospect.updatedAt,
        } satisfies DashboardQualifiedLeadRow;
      });

  listActiveThreads: TrellisRepositoryPort["listActiveThreads"] = async (limit = 20) =>
    [...this.threads.values()]
      .filter((thread) => thread.status === "active" || thread.status === "paused")
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit)
      .map((thread) => {
        const prospect = this.requireProspect(thread.prospectId);
        return {
          threadId: thread.id,
          prospectId: prospect.prospectId,
          fullName: prospect.fullName,
          company: prospect.company,
          title: prospect.title,
          linkedinUrl: prospect.linkedinUrl,
          twitterUrl: prospect.twitterUrl,
          stage: thread.stage,
          status: thread.status,
          qualificationReason: prospect.qualificationReason,
          qualification: prospect.qualification,
          pausedReason: thread.pausedReason ?? prospect.pausedReason,
          nextFollowUpAt: thread.nextFollowUpAt,
          updatedAt: thread.updatedAt,
        } satisfies DashboardActiveThreadRow;
      });

  listRecentProviderRuns: TrellisRepositoryPort["listRecentProviderRuns"] = async (limit = 20) =>
    this.providerRuns
      .slice()
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);

  listRecentAuditEvents: TrellisRepositoryPort["listRecentAuditEvents"] = async (limit = 30) =>
    this.auditEvents
      .slice()
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);

  listAuditEventsForEntity: TrellisRepositoryPort["listAuditEventsForEntity"] = async (
    entityType,
    entityId,
    limit = 20,
  ) =>
    this.auditEvents
      .filter((event) => event.entityType === entityType && event.entityId === entityId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);

  findWorkflowProspectMatches: TrellisRepositoryPort["findWorkflowProspectMatches"] = async (input) => {
    const companyDomain = normalizeComparable(input.companyDomain);
    const companyName = normalizeComparable(input.companyName);
    const email = normalizeComparable(input.email);
    const linkedinUrl = normalizeComparable(input.linkedinUrl);
    const twitterUrl = normalizeComparable(input.twitterUrl);
    const fullName = input.fullName?.trim() || null;
    const limit = Math.max(1, Math.min(input.limit ?? 25, 100));

    if (!companyDomain && !companyName && !email && !linkedinUrl && !twitterUrl && !fullName) {
      return [];
    }

    const results: WorkflowProspectMatchRow[] = [];
    for (const thread of this.threads.values()) {
      if (thread.status !== "active" && thread.status !== "paused") {
        continue;
      }
      const prospect = this.prospects.get(thread.prospectId);
      if (!prospect) {
        continue;
      }
      const bestEmail = this.emails.get(prospect.prospectId)?.address ?? null;
      const matched =
        (companyDomain && normalizeComparable(prospect.companyDomain) === companyDomain)
        || (email && normalizeComparable(bestEmail) === email)
        || (linkedinUrl && normalizeComparable(prospect.linkedinUrl) === linkedinUrl)
        || (twitterUrl && normalizeComparable(prospect.twitterUrl) === twitterUrl)
        || (
          fullName
          && prospect.fullName === fullName
          && (
            !companyDomain
            || normalizeComparable(prospect.companyDomain) === companyDomain
            || normalizeComparable(prospect.company) === companyName
          )
        );

      if (!matched) {
        continue;
      }

      results.push({
        prospectId: prospect.prospectId,
        threadId: thread.id,
        fullName: prospect.fullName,
        company: prospect.company,
        companyDomain: prospect.companyDomain,
        linkedinUrl: prospect.linkedinUrl,
        twitterUrl: prospect.twitterUrl,
        email: bestEmail,
        stage: thread.stage,
        status: thread.status,
        updatedAt: prospect.updatedAt,
      });
    }

    return results
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);
  };

  recordProviderRun: TrellisRepositoryPort["recordProviderRun"] = async (input) => {
    const id = createId("prov");
    const now = nowIso();
    this.providerRuns.unshift({
      id,
      provider: input.provider,
      kind: input.kind,
      externalId: input.externalId ?? null,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      durationMs: null,
      requestTerm: null,
      error: null,
      requestPayload: input.requestPayload,
      responsePayload: input.responsePayload,
    });
    return id;
  };

  updateProviderRun: TrellisRepositoryPort["updateProviderRun"] = async (id, input) => {
    const run = this.providerRuns.find((candidate) => candidate.id === id);
    if (!run) {
      return;
    }
    run.status = input.status;
    run.updatedAt = nowIso();
    run.responsePayload = input.responsePayload;
    run.error = typeof input.responsePayload?.error === "string" ? input.responsePayload.error : null;
  };

  insertSignal: TrellisRepositoryPort["insertSignal"] = async (input) => {
    this.signals.unshift({ ...input });
    return input.id;
  };

  getSignal: TrellisRepositoryPort["getSignal"] = async (signalId) =>
    this.signals.find((signal) => signal.id === signalId) ?? null;

  createOrUpdateProspectFromSignal: TrellisRepositoryPort["createOrUpdateProspectFromSignal"] = async (signalId, campaignId) => {
    const existing = this.prospectBySignal.get(signalId);
    if (existing) {
      return existing;
    }

    const signal = this.signals.find((candidate) => candidate.id === signalId);
    if (!signal) {
      throw new Error(`signal ${signalId} not found in local smoke mode`);
    }
    if (signal.campaignId !== campaignId) {
      throw new Error(`signal ${signalId} does not belong to campaign ${campaignId}`);
    }

    const signature = [
      campaignId,
      signal.source,
      signal.sourceRef,
      signal.authorName.toLowerCase(),
      (signal.authorCompany ?? "").toLowerCase(),
    ].join("|");

    const prospectId = this.prospectBySignature.get(signature) ?? createId("pros");
    let threadId: string;
    const now = nowIso();

    if (this.prospects.has(prospectId)) {
      const existingProspect = this.requireProspect(prospectId);
      threadId = this.requireThreadByProspect(prospectId).id;
      existingProspect.sourceSignalId = signal.id;
      existingProspect.company = signal.authorCompany ?? existingProspect.company;
      existingProspect.companyDomain = signal.companyDomain ?? existingProspect.companyDomain;
      existingProspect.title = signal.authorTitle ?? existingProspect.title;
      existingProspect.linkedinUrl = toLinkedinProfileUrl(signal) ?? existingProspect.linkedinUrl;
      existingProspect.twitterUrl = toTwitterProfileUrl(signal) ?? existingProspect.twitterUrl;
      existingProspect.updatedAt = now;
    } else {
      threadId = createId("thr");
      const prospect: ProspectStore = {
        prospectId,
        accountId: null,
        campaignId,
        fullName: signal.authorName,
        firstName: firstNameFromFullName(signal.authorName),
        title: signal.authorTitle ?? null,
        company: signal.authorCompany ?? null,
        companyDomain: signal.companyDomain ?? null,
        linkedinUrl: toLinkedinProfileUrl(signal),
        twitterUrl: toTwitterProfileUrl(signal),
        attioCompanyRecordId: null,
        attioPersonRecordId: null,
        attioListEntryId: null,
        sourceSignalId: signal.id,
        status: "active",
        stage: "capture_signal",
        lastReplyClass: null,
        pausedReason: null,
        qualificationReason: null,
        qualification: null,
        updatedAt: now,
      };
      const thread: ThreadStore = {
        id: threadId,
        prospectId,
        campaignId,
        stage: "capture_signal",
        status: "active",
        lastReplyClass: null,
        pausedReason: null,
        nextFollowUpAt: null,
        providerThreadId: null,
        providerInboxId: null,
        updatedAt: now,
      };
      this.prospects.set(prospectId, prospect);
      this.threads.set(threadId, thread);
      this.prospectBySignature.set(signature, prospectId);
      this.messages.set(threadId, []);
    }

    const ref = { prospectId, threadId };
    this.prospectBySignal.set(signalId, ref);
    return ref;
  };

  getProspectSnapshot: TrellisRepositoryPort["getProspectSnapshot"] = async (prospectId) => {
    const prospect = this.requireProspect(prospectId);
    const thread = this.requireThreadByProspect(prospectId);
    return {
      prospect: {
        prospectId: prospect.prospectId,
        accountId: prospect.accountId,
        campaignId: prospect.campaignId,
        fullName: prospect.fullName,
        firstName: prospect.firstName,
        title: prospect.title,
        company: prospect.company,
        companyDomain: prospect.companyDomain,
        linkedinUrl: prospect.linkedinUrl,
        twitterUrl: prospect.twitterUrl,
        attioCompanyRecordId: prospect.attioCompanyRecordId,
        attioPersonRecordId: prospect.attioPersonRecordId,
        attioListEntryId: prospect.attioListEntryId,
        sourceSignalId: prospect.sourceSignalId,
        status: prospect.status,
        stage: prospect.stage,
        lastReplyClass: prospect.lastReplyClass,
        pausedReason: prospect.pausedReason,
      },
      qualificationReason: prospect.qualificationReason,
      qualification: prospect.qualification,
      campaign: { ...this.campaign },
      thread: {
        id: thread.id,
        stage: thread.stage,
        status: thread.status,
        lastReplyClass: thread.lastReplyClass,
        pausedReason: thread.pausedReason,
        nextFollowUpAt: thread.nextFollowUpAt,
        providerThreadId: thread.providerThreadId,
        providerInboxId: thread.providerInboxId,
      },
      email: this.emails.get(prospectId) ?? null,
      researchBrief: this.getLatestResearchBriefSync(prospectId),
      messages: (this.messages.get(thread.id) ?? []).map((message) => ({
        id: message.id,
        direction: message.direction,
        kind: message.kind,
        subject: message.subject,
        bodyText: message.bodyText,
        classification: message.classification,
        createdAt: message.createdAt,
      })),
    } satisfies ProspectSnapshot;
  };

  getProspectIdByProviderThreadId: TrellisRepositoryPort["getProspectIdByProviderThreadId"] = async (providerThreadId) => {
    const thread = [...this.threads.values()].find((candidate) => candidate.providerThreadId === providerThreadId);
    return thread ? { prospectId: thread.prospectId, threadId: thread.id } : null;
  };

  getBestContactEmail: TrellisRepositoryPort["getBestContactEmail"] = async (prospectId) => this.emails.get(prospectId) ?? null;

  upsertContactEmail: TrellisRepositoryPort["upsertContactEmail"] = async (prospectId, email) => {
    this.requireProspect(prospectId);
    this.emails.set(prospectId, email);
  };

  saveResearchBrief: TrellisRepositoryPort["saveResearchBrief"] = async (input) => {
    this.requireProspect(input.prospectId);
    const brief: ResearchBrief = {
      id: createId("rsh"),
      prospectId: input.prospectId,
      campaignId: input.campaignId,
      summary: input.summary,
      copyGuidance: input.copyGuidance ?? null,
      evidence: input.evidence,
      confidence: input.confidence,
      createdAt: Date.now(),
    };
    const list = this.researchBriefs.get(input.prospectId) ?? [];
    list.unshift(brief);
    this.researchBriefs.set(input.prospectId, list);
    this.touchProspect(input.prospectId);
    return brief.id;
  };

  getLatestResearchBrief: TrellisRepositoryPort["getLatestResearchBrief"] = async (prospectId) =>
    this.getLatestResearchBriefSync(prospectId);

  listMessages: TrellisRepositoryPort["listMessages"] = async (threadId) =>
    (this.messages.get(threadId) ?? []).map((message) => ({
      id: message.id,
      direction: message.direction,
      kind: message.kind,
      subject: message.subject,
      bodyText: message.bodyText,
      classification: message.classification,
      createdAt: message.createdAt,
    }));

  addMessage: TrellisRepositoryPort["addMessage"] = async (input) => {
    this.requireThread(input.threadId);
    const message: MessageStore = {
      id: createId("msg"),
      threadId: input.threadId,
      providerMessageId: input.providerMessageId ?? null,
      direction: input.direction,
      kind: input.kind,
      subject: input.subject ?? null,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml ?? null,
      classification: input.classification ?? null,
      metadata: input.metadata ?? {},
      createdAt: nowIso(),
    };
    const list = this.messages.get(input.threadId) ?? [];
    list.push(message);
    this.messages.set(input.threadId, list);
    this.touchThreadById(input.threadId);
    return message.id;
  };

  updateThreadState: TrellisRepositoryPort["updateThreadState"] = async (input) => {
    const thread = this.requireThread(input.threadId);
    if (input.stage !== undefined) {
      thread.stage = input.stage;
    }
    if (input.status !== undefined) {
      thread.status = input.status;
    }
    if (input.lastReplyClass !== undefined) {
      thread.lastReplyClass = input.lastReplyClass;
    }
    if (input.pausedReason !== undefined) {
      thread.pausedReason = input.pausedReason;
    }
    if (input.providerThreadId !== undefined) {
      thread.providerThreadId = input.providerThreadId;
    }
    if (input.providerInboxId !== undefined) {
      thread.providerInboxId = input.providerInboxId;
    }
    if (input.nextFollowUpAt !== undefined) {
      thread.nextFollowUpAt = input.nextFollowUpAt;
    }
    thread.updatedAt = nowIso();
  };

  updateProspectState: TrellisRepositoryPort["updateProspectState"] = async (input) => {
    const prospect = this.requireProspect(input.prospectId);
    if (input.stage !== undefined) {
      prospect.stage = input.stage;
    }
    if (input.status !== undefined) {
      prospect.status = input.status;
    }
    if (input.lastReplyClass !== undefined) {
      prospect.lastReplyClass = input.lastReplyClass;
    }
    if (input.pausedReason !== undefined) {
      prospect.pausedReason = input.pausedReason;
    }
    prospect.updatedAt = nowIso();
  };

  updateProspectCrmReferences: TrellisRepositoryPort["updateProspectCrmReferences"] = async (input) => {
    const prospect = this.requireProspect(input.prospectId);
    if (input.attioCompanyRecordId !== undefined) {
      prospect.attioCompanyRecordId = input.attioCompanyRecordId;
    }
    if (input.attioPersonRecordId !== undefined) {
      prospect.attioPersonRecordId = input.attioPersonRecordId;
    }
    if (input.attioListEntryId !== undefined) {
      prospect.attioListEntryId = input.attioListEntryId;
    }
    prospect.updatedAt = nowIso();
  };

  applyQualificationAssessment: TrellisRepositoryPort["applyQualificationAssessment"] = async (prospectId, assessment) => {
    const prospect = this.requireProspect(prospectId);
    prospect.qualification = assessment;
    prospect.qualificationReason = assessment.reason;
    prospect.updatedAt = nowIso();
  };

  pauseThread: TrellisRepositoryPort["pauseThread"] = async (threadId, reason) => {
    const thread = this.requireThread(threadId);
    const prospect = this.requireProspect(thread.prospectId);
    const now = nowIso();
    thread.status = "paused";
    thread.pausedReason = reason;
    thread.updatedAt = now;
    prospect.status = "paused";
    prospect.pausedReason = reason;
    prospect.updatedAt = now;
  };

  createHandoff: TrellisRepositoryPort["createHandoff"] = async (threadId, target, payload) => {
    this.requireThread(threadId);
    const handoffId = createId("handoff");
    this.handoffs.set(handoffId, {
      id: handoffId,
      threadId,
      target,
      payload,
      status: "queued",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return handoffId;
  };

  markHandoffStatus: TrellisRepositoryPort["markHandoffStatus"] = async (handoffId, status) => {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      return;
    }
    handoff.status = status;
    handoff.updatedAt = nowIso();
  };

  appendAuditEvent: TrellisRepositoryPort["appendAuditEvent"] = async (
    entityType,
    entityId,
    eventName,
    payload,
  ) => {
    this.auditEvents.unshift({
      id: createId("audit"),
      entityType,
      entityId,
      eventName: eventName as InternalEventName | string,
      payload,
      createdAt: nowIso(),
    });
  };

  countOutboundMessages: TrellisRepositoryPort["countOutboundMessages"] = async (threadId) =>
    (this.messages.get(threadId) ?? []).filter((message) => message.direction === "outbound").length;

  getLatestInboundMessage: TrellisRepositoryPort["getLatestInboundMessage"] = async (threadId) => {
    const message = (this.messages.get(threadId) ?? [])
      .filter((candidate) => candidate.direction === "inbound")
      .slice()
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
    if (!message) {
      return null;
    }
    return {
      id: message.id,
      subject: message.subject,
      body_text: message.bodyText,
      provider_message_id: message.providerMessageId,
      created_at: message.createdAt,
    };
  };

  getThread: TrellisRepositoryPort["getThread"] = async (threadId) => {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return null;
    }
    return {
      id: thread.id,
      prospect_id: thread.prospectId,
      campaign_id: thread.campaignId,
      stage: thread.stage,
      status: thread.status,
      last_reply_class: thread.lastReplyClass,
      paused_reason: thread.pausedReason,
      provider_thread_id: thread.providerThreadId,
      provider_inbox_id: thread.providerInboxId,
    };
  };

  touchThreadFollowup: TrellisRepositoryPort["touchThreadFollowup"] = async (threadId, dateIso) => {
    const thread = this.requireThread(threadId);
    thread.nextFollowUpAt = dateIso;
    thread.updatedAt = nowIso();
  };

  saveSandboxTranscript: TrellisRepositoryPort["saveSandboxTranscript"] = async () => undefined;

  getCampaignPolicyForProspect: TrellisRepositoryPort["getCampaignPolicyForProspect"] = async () => ({ ...this.campaign });

  private getLatestResearchBriefSync(prospectId: string) {
    return (this.researchBriefs.get(prospectId) ?? [])
      .slice()
      .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  }

  private toDashboardProspectRow(prospect: ProspectStore): DashboardProspectRow {
    return {
      id: prospect.prospectId,
      fullName: prospect.fullName,
      company: prospect.company,
      title: prospect.title,
      stage: prospect.stage,
      status: prospect.status,
      isQualified: Boolean(prospect.qualification?.ok),
      qualificationReason: prospect.qualificationReason,
      qualification: prospect.qualification,
      pausedReason: prospect.pausedReason,
      updatedAt: prospect.updatedAt,
    };
  }

  private requireProspect(prospectId: string) {
    const prospect = this.prospects.get(prospectId);
    if (!prospect) {
      throw new Error(`prospect ${prospectId} not found in local smoke mode`);
    }
    return prospect;
  }

  private requireThread(threadId: string) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`thread ${threadId} not found in local smoke mode`);
    }
    return thread;
  }

  private requireThreadByProspect(prospectId: string) {
    const thread = [...this.threads.values()].find((candidate) => candidate.prospectId === prospectId);
    if (!thread) {
      throw new Error(`thread for prospect ${prospectId} not found in local smoke mode`);
    }
    return thread;
  }

  private touchProspect(prospectId: string) {
    const prospect = this.requireProspect(prospectId);
    prospect.updatedAt = nowIso();
  }

  private touchThreadById(threadId: string) {
    const thread = this.requireThread(threadId);
    thread.updatedAt = nowIso();
    this.touchProspect(thread.prospectId);
  }
}
