import type {
  CampaignSenderIdentity,
  ContactEmail,
  InternalEventName,
  LifecycleStage,
  ProspectContext,
  QualificationAssessment,
  ReplyClass,
  ResearchBrief,
  SignalRecord,
  ThreadStatus,
} from "./domain-types.js";

export interface CampaignPolicy extends CampaignSenderIdentity {
  id: string;
  name: string;
  status: string;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  touchCap: number;
  emailConfidenceThreshold: number;
  researchConfidenceThreshold: number;
  sourceLinkedinEnabled: boolean;
}

export interface ControlFlags {
  globalKillSwitch: boolean;
  noSendsMode: boolean;
  pausedCampaignIds: string[];
}

export interface DashboardSummary {
  signals: number;
  prospects: number;
  qualifiedLeads: number;
  activeThreads: number;
  pausedThreads: number;
  providerRuns24h: number;
  globalKillSwitch: boolean;
  noSendsMode: boolean;
}

export interface DashboardSignalRow {
  id: string;
  source: string;
  topic: string;
  authorName: string;
  authorCompany: string | null;
  url: string;
  capturedAt: string;
}

export interface DashboardProspectRow {
  id: string;
  fullName: string;
  company: string | null;
  title: string | null;
  stage: string;
  status: string;
  isQualified: boolean;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  pausedReason: string | null;
  updatedAt: string;
}

export interface DashboardQualifiedLeadRow {
  prospectId: string;
  fullName: string;
  company: string | null;
  title: string | null;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  threadStatus: string;
  researchConfidence: number | null;
  email: string | null;
  emailConfidence: number | null;
  updatedAt: string;
}

export interface DashboardActiveThreadRow {
  threadId: string;
  prospectId: string;
  fullName: string;
  company: string | null;
  title: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  stage: string;
  status: string;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  nextFollowUpAt: string | null;
  updatedAt: string;
}

export interface DashboardProviderRunRow {
  id: string;
  provider: string;
  kind: string;
  externalId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  durationMs: number | null;
  requestTerm: string | null;
  error: string | null;
}

export interface DashboardAuditEventRow {
  id: string;
  entityType: string;
  entityId: string;
  eventName: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProspectSnapshot {
  prospect: ProspectContext;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  campaign: CampaignPolicy;
  thread: {
    id: string;
    stage: LifecycleStage;
    status: ThreadStatus;
    lastReplyClass: ReplyClass | null;
    pausedReason: string | null;
    nextFollowUpAt: string | null;
    providerThreadId: string | null;
    providerInboxId: string | null;
  };
  email: ContactEmail | null;
  researchBrief: ResearchBrief | null;
  messages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    kind: string;
    subject: string | null;
    bodyText: string;
    classification: ReplyClass | null;
    createdAt: string;
  }>;
}

export interface MessageInsertInput {
  threadId: string;
  providerMessageId?: string | null;
  direction: "inbound" | "outbound";
  kind: string;
  subject?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  classification?: ReplyClass | null;
  metadata?: Record<string, unknown>;
}

export interface TrellisRepositoryPort {
  ensureDefaultCampaign(): Promise<CampaignPolicy>;
  getCampaign(campaignId: string): Promise<CampaignPolicy>;
  getControlFlags(): Promise<ControlFlags>;
  setControlFlag(key: string, value: Record<string, unknown>): Promise<void>;
  setCampaignLinkedinSource(campaignId: string, enabled: boolean): Promise<void>;
  setCampaignTimezone(campaignId: string, timezone: string): Promise<void>;
  updateCampaignSenderIdentity(input: {
    campaignId: string;
    senderEmail?: string | null;
    senderDisplayName?: string | null;
    senderProviderInboxId?: string | null;
  }): Promise<void>;
  getDashboardSummary(): Promise<DashboardSummary>;
  listRecentSignals(limit?: number): Promise<DashboardSignalRow[]>;
  listRecentProspects(limit?: number): Promise<DashboardProspectRow[]>;
  getProspectDashboardRow(prospectId: string): Promise<DashboardProspectRow | null>;
  listQualifiedLeads(limit?: number): Promise<DashboardQualifiedLeadRow[]>;
  listActiveThreads(limit?: number): Promise<DashboardActiveThreadRow[]>;
  listRecentProviderRuns(limit?: number): Promise<DashboardProviderRunRow[]>;
  listRecentAuditEvents(limit?: number): Promise<DashboardAuditEventRow[]>;
  listAuditEventsForEntity(entityType: string, entityId: string, limit?: number): Promise<DashboardAuditEventRow[]>;
  recordProviderRun(input: {
    provider: string;
    kind: string;
    externalId?: string | null;
    status: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
  }): Promise<string>;
  updateProviderRun(id: string, input: {
    status: string;
    responsePayload?: Record<string, unknown>;
  }): Promise<void>;
  insertSignal(input: SignalRecord & { campaignId: string; datasetId?: string | null }): Promise<string>;
  getSignal(signalId: string): Promise<(SignalRecord & { campaignId: string }) | null>;
  createOrUpdateProspectFromSignal(signalId: string, campaignId: string): Promise<{ prospectId: string; threadId: string }>;
  getProspectSnapshot(prospectId: string): Promise<ProspectSnapshot>;
  getProspectIdByProviderThreadId(providerThreadId: string): Promise<{ prospectId: string; threadId: string } | null>;
  getBestContactEmail(prospectId: string): Promise<ContactEmail | null>;
  upsertContactEmail(prospectId: string, email: ContactEmail): Promise<void>;
  saveResearchBrief(input: Omit<ResearchBrief, "id" | "createdAt"> & { metadata?: Record<string, unknown> }): Promise<string>;
  getLatestResearchBrief(prospectId: string): Promise<ResearchBrief | null>;
  listMessages(threadId: string): Promise<ProspectSnapshot["messages"]>;
  addMessage(input: MessageInsertInput): Promise<string>;
  updateThreadState(input: {
    threadId: string;
    stage?: LifecycleStage;
    status?: ThreadStatus;
    lastReplyClass?: ReplyClass | null;
    pausedReason?: string | null;
    providerThreadId?: string | null;
    providerInboxId?: string | null;
    nextFollowUpAt?: string | null;
  }): Promise<void>;
  updateProspectState(input: {
    prospectId: string;
    stage?: LifecycleStage;
    status?: ThreadStatus;
    lastReplyClass?: ReplyClass | null;
    pausedReason?: string | null;
  }): Promise<void>;
  updateProspectCrmReferences(input: {
    prospectId: string;
    attioCompanyRecordId?: string | null;
    attioPersonRecordId?: string | null;
    attioListEntryId?: string | null;
  }): Promise<void>;
  applyQualificationAssessment(prospectId: string, assessment: QualificationAssessment): Promise<void>;
  pauseThread(threadId: string, reason: string): Promise<void>;
  createHandoff(threadId: string, target: string, payload: Record<string, unknown>): Promise<string>;
  markHandoffStatus(handoffId: string, status: string): Promise<void>;
  appendAuditEvent(entityType: string, entityId: string, eventName: InternalEventName | string, payload: Record<string, unknown>): Promise<void>;
  countOutboundMessages(threadId: string): Promise<number>;
  getLatestInboundMessage(threadId: string): Promise<{
    id: string;
    subject: string | null;
    body_text: string;
    provider_message_id: string | null;
    created_at: string;
  } | null>;
  getThread(threadId: string): Promise<{
    id: string;
    prospect_id: string;
    campaign_id: string;
    stage: string;
    status: string;
    last_reply_class: string | null;
    paused_reason: string | null;
    provider_thread_id: string | null;
    provider_inbox_id: string | null;
  } | null>;
  touchThreadFollowup(threadId: string, dateIso: string | null): Promise<void>;
  saveSandboxTranscript(input: {
    threadId: string;
    stage: LifecycleStage;
    transcript: unknown[];
    outputText: string;
    usage?: Record<string, unknown>;
  }): Promise<void>;
  getCampaignPolicyForProspect(prospectId: string): Promise<CampaignPolicy>;
}
