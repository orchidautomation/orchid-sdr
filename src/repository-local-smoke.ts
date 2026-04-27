import { createId } from "./lib/ids.js";
import type {
  CampaignPolicy,
  ControlFlags,
  DashboardAuditEventRow,
  DashboardProviderRunRow,
  DashboardSignalRow,
  OrchidRepositoryPort,
} from "./repository.js";
import type {
  InternalEventName,
  SignalRecord,
} from "./domain/types.js";

const DEFAULT_CAMPAIGN_ID = "cmp_default";

type ProviderRunStore = DashboardProviderRunRow & {
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
};

type StoredSignal = SignalRecord & {
  campaignId: string;
  datasetId?: string | null;
};

export class LocalSmokeRepository implements OrchidRepositoryPort {
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

  ensureDefaultCampaign: OrchidRepositoryPort["ensureDefaultCampaign"] = async () => ({ ...this.campaign });

  getCampaign: OrchidRepositoryPort["getCampaign"] = async (campaignId) => {
    if (campaignId !== this.campaign.id) {
      throw new Error(`campaign ${campaignId} not found in local smoke mode`);
    }
    return { ...this.campaign };
  };

  getControlFlags: OrchidRepositoryPort["getControlFlags"] = async () => ({ ...this.controlFlags });

  setControlFlag: OrchidRepositoryPort["setControlFlag"] = async (key, value) => {
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

  setCampaignLinkedinSource: OrchidRepositoryPort["setCampaignLinkedinSource"] = async (campaignId, enabled) => {
    if (campaignId !== this.campaign.id) {
      throw new Error(`campaign ${campaignId} not found in local smoke mode`);
    }
    this.campaign.sourceLinkedinEnabled = enabled;
  };

  setCampaignTimezone: OrchidRepositoryPort["setCampaignTimezone"] = async (campaignId, timezone) => {
    if (campaignId !== this.campaign.id) {
      throw new Error(`campaign ${campaignId} not found in local smoke mode`);
    }
    this.campaign.timezone = timezone;
  };

  updateCampaignSenderIdentity: OrchidRepositoryPort["updateCampaignSenderIdentity"] = async (input) => {
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

  getDashboardSummary: OrchidRepositoryPort["getDashboardSummary"] = async () => ({
    signals: this.signals.length,
    prospects: 0,
    qualifiedLeads: 0,
    activeThreads: 0,
    pausedThreads: 0,
    providerRuns24h: this.providerRuns.length,
    globalKillSwitch: this.controlFlags.globalKillSwitch,
    noSendsMode: this.controlFlags.noSendsMode,
  });

  listRecentSignals: OrchidRepositoryPort["listRecentSignals"] = async (limit = 20) =>
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

  listRecentProspects: OrchidRepositoryPort["listRecentProspects"] = async (_limit = 20) => [];

  getProspectDashboardRow: OrchidRepositoryPort["getProspectDashboardRow"] = async (_prospectId) => null;

  listQualifiedLeads: OrchidRepositoryPort["listQualifiedLeads"] = async (_limit = 20) => [];

  listActiveThreads: OrchidRepositoryPort["listActiveThreads"] = async (_limit = 20) => [];

  listRecentProviderRuns: OrchidRepositoryPort["listRecentProviderRuns"] = async (limit = 20) =>
    this.providerRuns
      .slice()
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);

  listRecentAuditEvents: OrchidRepositoryPort["listRecentAuditEvents"] = async (limit = 30) =>
    this.auditEvents
      .slice()
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);

  listAuditEventsForEntity: OrchidRepositoryPort["listAuditEventsForEntity"] = async (
    entityType,
    entityId,
    limit = 20,
  ) =>
    this.auditEvents
      .filter((event) => event.entityType === entityType && event.entityId === entityId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, limit);

  recordProviderRun: OrchidRepositoryPort["recordProviderRun"] = async (input) => {
    const id = createId("prov");
    const now = new Date().toISOString();
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

  updateProviderRun: OrchidRepositoryPort["updateProviderRun"] = async (id, input) => {
    const run = this.providerRuns.find((candidate) => candidate.id === id);
    if (!run) {
      return;
    }
    run.status = input.status;
    run.updatedAt = new Date().toISOString();
    run.responsePayload = input.responsePayload;
    run.error = typeof input.responsePayload?.error === "string" ? input.responsePayload.error : null;
  };

  insertSignal: OrchidRepositoryPort["insertSignal"] = async (input) => {
    this.signals.unshift({ ...input });
    return input.id;
  };

  getSignal: OrchidRepositoryPort["getSignal"] = async (signalId) =>
    this.signals.find((signal) => signal.id === signalId) ?? null;

  createOrUpdateProspectFromSignal: OrchidRepositoryPort["createOrUpdateProspectFromSignal"] = async () =>
    this.unsupported("createOrUpdateProspectFromSignal");

  getProspectSnapshot: OrchidRepositoryPort["getProspectSnapshot"] = async () =>
    this.unsupported("getProspectSnapshot");

  getProspectIdByProviderThreadId: OrchidRepositoryPort["getProspectIdByProviderThreadId"] = async () => null;

  getBestContactEmail: OrchidRepositoryPort["getBestContactEmail"] = async () => null;

  upsertContactEmail: OrchidRepositoryPort["upsertContactEmail"] = async () =>
    this.unsupported("upsertContactEmail");

  saveResearchBrief: OrchidRepositoryPort["saveResearchBrief"] = async () =>
    this.unsupported("saveResearchBrief");

  getLatestResearchBrief: OrchidRepositoryPort["getLatestResearchBrief"] = async () => null;

  listMessages: OrchidRepositoryPort["listMessages"] = async () => [];

  addMessage: OrchidRepositoryPort["addMessage"] = async (_input) =>
    this.unsupported("addMessage");

  updateThreadState: OrchidRepositoryPort["updateThreadState"] = async () =>
    this.unsupported("updateThreadState");

  updateProspectState: OrchidRepositoryPort["updateProspectState"] = async () =>
    this.unsupported("updateProspectState");

  updateProspectCrmReferences: OrchidRepositoryPort["updateProspectCrmReferences"] = async () =>
    this.unsupported("updateProspectCrmReferences");

  applyQualificationAssessment: OrchidRepositoryPort["applyQualificationAssessment"] = async () =>
    this.unsupported("applyQualificationAssessment");

  pauseThread: OrchidRepositoryPort["pauseThread"] = async () =>
    this.unsupported("pauseThread");

  createHandoff: OrchidRepositoryPort["createHandoff"] = async () =>
    this.unsupported("createHandoff");

  markHandoffStatus: OrchidRepositoryPort["markHandoffStatus"] = async () =>
    this.unsupported("markHandoffStatus");

  appendAuditEvent: OrchidRepositoryPort["appendAuditEvent"] = async (
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
      createdAt: new Date().toISOString(),
    });
  };

  countOutboundMessages: OrchidRepositoryPort["countOutboundMessages"] = async () => 0;

  getLatestInboundMessage: OrchidRepositoryPort["getLatestInboundMessage"] = async () => null;

  getThread: OrchidRepositoryPort["getThread"] = async () => null;

  touchThreadFollowup: OrchidRepositoryPort["touchThreadFollowup"] = async () =>
    this.unsupported("touchThreadFollowup");

  saveSandboxTranscript: OrchidRepositoryPort["saveSandboxTranscript"] = async () => undefined;

  getCampaignPolicyForProspect: OrchidRepositoryPort["getCampaignPolicyForProspect"] = async () => ({ ...this.campaign });

  private unsupported(operation: string): never {
    throw new Error(`Local smoke mode is boot-only. ${operation} is not supported.`);
  }
}
