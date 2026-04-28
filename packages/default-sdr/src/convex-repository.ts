import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  ContactEmail,
  InternalEventName,
  LifecycleStage,
  QualificationAssessment,
  ResearchBrief,
  ReplyClass,
  SignalRecord,
  ThreadStatus,
} from "./domain-types.js";
import type {
  CampaignPolicy,
  ControlFlags,
  DashboardActiveThreadRow,
  DashboardAuditEventRow,
  DashboardProspectRow,
  DashboardProviderRunRow,
  DashboardQualifiedLeadRow,
  DashboardSignalRow,
  DashboardSummary,
  MessageInsertInput,
  TrellisRepositoryPort,
  ProspectSnapshot,
} from "./repository-contracts.js";

const convexQueries = {
  getCampaign: makeFunctionReference<"query">("repository:getCampaign"),
  getControlFlags: makeFunctionReference<"query">("repository:getControlFlags"),
  getDashboardSummary: makeFunctionReference<"query">("repository:getDashboardSummary"),
  listRecentSignals: makeFunctionReference<"query">("repository:listRecentSignals"),
  listRecentProspects: makeFunctionReference<"query">("repository:listRecentProspects"),
  getProspectDashboardRow: makeFunctionReference<"query">("repository:getProspectDashboardRow"),
  listQualifiedLeads: makeFunctionReference<"query">("repository:listQualifiedLeads"),
  listActiveThreads: makeFunctionReference<"query">("repository:listActiveThreads"),
  listRecentProviderRuns: makeFunctionReference<"query">("repository:listRecentProviderRuns"),
  listRecentAuditEvents: makeFunctionReference<"query">("repository:listRecentAuditEvents"),
  listAuditEventsForEntity: makeFunctionReference<"query">("repository:listAuditEventsForEntity"),
  getSignal: makeFunctionReference<"query">("repository:getSignal"),
  getProspectSnapshot: makeFunctionReference<"query">("repository:getProspectSnapshot"),
  getProspectIdByProviderThreadId: makeFunctionReference<"query">("repository:getProspectIdByProviderThreadId"),
  getBestContactEmail: makeFunctionReference<"query">("repository:getBestContactEmail"),
  getLatestResearchBrief: makeFunctionReference<"query">("repository:getLatestResearchBrief"),
  listMessages: makeFunctionReference<"query">("repository:listMessages"),
  countOutboundMessages: makeFunctionReference<"query">("repository:countOutboundMessages"),
  getLatestInboundMessage: makeFunctionReference<"query">("repository:getLatestInboundMessage"),
  getThread: makeFunctionReference<"query">("repository:getThread"),
  getCampaignPolicyForProspect: makeFunctionReference<"query">("repository:getCampaignPolicyForProspect"),
};

const convexMutations = {
  ensureDefaultCampaign: makeFunctionReference<"mutation">("repository:ensureDefaultCampaign"),
  setControlFlag: makeFunctionReference<"mutation">("repository:setControlFlag"),
  setCampaignLinkedinSource: makeFunctionReference<"mutation">("repository:setCampaignLinkedinSource"),
  setCampaignTimezone: makeFunctionReference<"mutation">("repository:setCampaignTimezone"),
  updateCampaignSenderIdentity: makeFunctionReference<"mutation">("repository:updateCampaignSenderIdentity"),
  recordProviderRun: makeFunctionReference<"mutation">("repository:recordProviderRun"),
  updateProviderRun: makeFunctionReference<"mutation">("repository:updateProviderRun"),
  insertSignal: makeFunctionReference<"mutation">("repository:insertSignal"),
  createOrUpdateProspectFromSignal: makeFunctionReference<"mutation">("repository:createOrUpdateProspectFromSignal"),
  upsertContactEmail: makeFunctionReference<"mutation">("repository:upsertContactEmail"),
  saveResearchBrief: makeFunctionReference<"mutation">("repository:saveResearchBrief"),
  addMessage: makeFunctionReference<"mutation">("repository:addMessage"),
  updateThreadState: makeFunctionReference<"mutation">("repository:updateThreadState"),
  updateProspectState: makeFunctionReference<"mutation">("repository:updateProspectState"),
  updateProspectCrmReferences: makeFunctionReference<"mutation">("repository:updateProspectCrmReferences"),
  applyQualificationAssessment: makeFunctionReference<"mutation">("repository:applyQualificationAssessment"),
  pauseThread: makeFunctionReference<"mutation">("repository:pauseThread"),
  createHandoff: makeFunctionReference<"mutation">("repository:createHandoff"),
  markHandoffStatus: makeFunctionReference<"mutation">("repository:markHandoffStatus"),
  appendAuditEvent: makeFunctionReference<"mutation">("repository:appendAuditEvent"),
  touchThreadFollowup: makeFunctionReference<"mutation">("repository:touchThreadFollowup"),
  saveSandboxTranscript: makeFunctionReference<"mutation">("repository:saveSandboxTranscript"),
};

export class ConvexRepository implements TrellisRepositoryPort {
  readonly providerId = "convex";
  private readonly client: ConvexHttpClient;

  constructor(
    convexUrl: string,
    private readonly defaultCampaignTimezone: string,
  ) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  ensureDefaultCampaign(): Promise<CampaignPolicy> {
    return this.client.mutation(convexMutations.ensureDefaultCampaign, {
      timezone: this.defaultCampaignTimezone,
    });
  }

  getCampaign(campaignId: string): Promise<CampaignPolicy> {
    return this.client.query(convexQueries.getCampaign, { campaignId });
  }

  getControlFlags(): Promise<ControlFlags> {
    return this.client.query(convexQueries.getControlFlags, {});
  }

  async setControlFlag(key: string, value: Record<string, unknown>) {
    await this.client.mutation(convexMutations.setControlFlag, { key, value: stripUndefinedDeep(value) });
  }

  async setCampaignLinkedinSource(campaignId: string, enabled: boolean) {
    await this.client.mutation(convexMutations.setCampaignLinkedinSource, { campaignId, enabled });
  }

  async setCampaignTimezone(campaignId: string, timezone: string) {
    await this.client.mutation(convexMutations.setCampaignTimezone, { campaignId, timezone });
  }

  async updateCampaignSenderIdentity(input: {
    campaignId: string;
    senderEmail?: string | null;
    senderDisplayName?: string | null;
    senderProviderInboxId?: string | null;
  }) {
    await this.client.mutation(
      convexMutations.updateCampaignSenderIdentity,
      stripUndefinedDeep(input),
    );
  }

  getDashboardSummary(): Promise<DashboardSummary> {
    return this.client.query(convexQueries.getDashboardSummary, {});
  }

  listRecentSignals(limit = 20): Promise<DashboardSignalRow[]> {
    return this.client.query(convexQueries.listRecentSignals, { limit });
  }

  listRecentProspects(limit = 20): Promise<DashboardProspectRow[]> {
    return this.client.query(convexQueries.listRecentProspects, { limit });
  }

  getProspectDashboardRow(prospectId: string): Promise<DashboardProspectRow | null> {
    return this.client.query(convexQueries.getProspectDashboardRow, { prospectId });
  }

  listQualifiedLeads(limit = 20): Promise<DashboardQualifiedLeadRow[]> {
    return this.client.query(convexQueries.listQualifiedLeads, { limit });
  }

  listActiveThreads(limit = 20): Promise<DashboardActiveThreadRow[]> {
    return this.client.query(convexQueries.listActiveThreads, { limit });
  }

  listRecentProviderRuns(limit = 20): Promise<DashboardProviderRunRow[]> {
    return this.client.query(convexQueries.listRecentProviderRuns, { limit });
  }

  listRecentAuditEvents(limit = 30): Promise<DashboardAuditEventRow[]> {
    return this.client.query(convexQueries.listRecentAuditEvents, { limit });
  }

  listAuditEventsForEntity(
    entityType: string,
    entityId: string,
    limit = 20,
  ): Promise<DashboardAuditEventRow[]> {
    return this.client.query(convexQueries.listAuditEventsForEntity, {
      entityType,
      entityId,
      limit,
    });
  }

  recordProviderRun(input: {
    provider: string;
    kind: string;
    externalId?: string | null;
    status: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
  }): Promise<string> {
    return this.client.mutation(
      convexMutations.recordProviderRun,
      stripUndefinedDeep(input),
    );
  }

  async updateProviderRun(
    id: string,
    input: {
      status: string;
      responsePayload?: Record<string, unknown>;
    },
  ) {
    await this.client.mutation(
      convexMutations.updateProviderRun,
      stripUndefinedDeep({
        id,
        ...input,
      }),
    );
  }

  insertSignal(input: SignalRecord & { campaignId: string; datasetId?: string | null }): Promise<string> {
    return this.client.mutation(
      convexMutations.insertSignal,
      stripUndefinedDeep(input),
    );
  }

  getSignal(signalId: string): Promise<(SignalRecord & { campaignId: string }) | null> {
    return this.client.query(convexQueries.getSignal, { signalId });
  }

  createOrUpdateProspectFromSignal(
    signalId: string,
    campaignId: string,
  ): Promise<{ prospectId: string; threadId: string }> {
    return this.client.mutation(convexMutations.createOrUpdateProspectFromSignal, {
      signalId,
      campaignId,
    });
  }

  getProspectSnapshot(prospectId: string): Promise<ProspectSnapshot> {
    return this.client.query(convexQueries.getProspectSnapshot, { prospectId });
  }

  getProspectIdByProviderThreadId(
    providerThreadId: string,
  ): Promise<{ prospectId: string; threadId: string } | null> {
    return this.client.query(convexQueries.getProspectIdByProviderThreadId, { providerThreadId });
  }

  getBestContactEmail(prospectId: string): Promise<ContactEmail | null> {
    return this.client.query(convexQueries.getBestContactEmail, { prospectId });
  }

  async upsertContactEmail(prospectId: string, email: ContactEmail) {
    await this.client.mutation(convexMutations.upsertContactEmail, {
      prospectId,
      email,
    });
  }

  saveResearchBrief(
    input: Omit<ResearchBrief, "id" | "createdAt"> & { metadata?: Record<string, unknown> },
  ): Promise<string> {
    return this.client.mutation(
      convexMutations.saveResearchBrief,
      stripUndefinedDeep({
        prospectId: input.prospectId,
        campaignId: input.campaignId,
        summary: input.summary,
        copyGuidance: input.copyGuidance ?? null,
        evidence: input.evidence,
        confidence: input.confidence,
        metadata: input.metadata ?? {},
      }),
    );
  }

  getLatestResearchBrief(prospectId: string): Promise<ResearchBrief | null> {
    return this.client.query(convexQueries.getLatestResearchBrief, { prospectId });
  }

  listMessages(threadId: string): Promise<ProspectSnapshot["messages"]> {
    return this.client.query(convexQueries.listMessages, { threadId });
  }

  addMessage(input: MessageInsertInput): Promise<string> {
    return this.client.mutation(
      convexMutations.addMessage,
      stripUndefinedDeep(input),
    );
  }

  async updateThreadState(input: {
    threadId: string;
    stage?: LifecycleStage;
    status?: ThreadStatus;
    lastReplyClass?: ReplyClass | null;
    pausedReason?: string | null;
    providerThreadId?: string | null;
    providerInboxId?: string | null;
    nextFollowUpAt?: string | null;
  }) {
    await this.client.mutation(
      convexMutations.updateThreadState,
      stripUndefinedDeep(input),
    );
  }

  async updateProspectState(input: {
    prospectId: string;
    stage?: LifecycleStage;
    status?: ThreadStatus;
    lastReplyClass?: ReplyClass | null;
    pausedReason?: string | null;
  }) {
    await this.client.mutation(
      convexMutations.updateProspectState,
      stripUndefinedDeep(input),
    );
  }

  async updateProspectCrmReferences(input: {
    prospectId: string;
    attioCompanyRecordId?: string | null;
    attioPersonRecordId?: string | null;
    attioListEntryId?: string | null;
  }) {
    await this.client.mutation(
      convexMutations.updateProspectCrmReferences,
      stripUndefinedDeep(input),
    );
  }

  async applyQualificationAssessment(prospectId: string, assessment: QualificationAssessment) {
    await this.client.mutation(convexMutations.applyQualificationAssessment, {
      prospectId,
      assessment: stripUndefinedDeep(assessment),
    });
  }

  async pauseThread(threadId: string, reason: string) {
    await this.client.mutation(convexMutations.pauseThread, { threadId, reason });
  }

  createHandoff(threadId: string, target: string, payload: Record<string, unknown>): Promise<string> {
    return this.client.mutation(convexMutations.createHandoff, {
      threadId,
      target,
      payload: stripUndefinedDeep(payload),
    });
  }

  async markHandoffStatus(handoffId: string, status: string) {
    await this.client.mutation(convexMutations.markHandoffStatus, { handoffId, status });
  }

  async appendAuditEvent(
    entityType: string,
    entityId: string,
    eventName: InternalEventName | string,
    payload: Record<string, unknown>,
  ) {
    await this.client.mutation(convexMutations.appendAuditEvent, {
      entityType,
      entityId,
      eventName,
      payload: stripUndefinedDeep(payload),
    });
  }

  countOutboundMessages(threadId: string): Promise<number> {
    return this.client.query(convexQueries.countOutboundMessages, { threadId });
  }

  getLatestInboundMessage(threadId: string): Promise<{
    id: string;
    subject: string | null;
    body_text: string;
    provider_message_id: string | null;
    created_at: string;
  } | null> {
    return this.client.query(convexQueries.getLatestInboundMessage, { threadId });
  }

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
  } | null> {
    return this.client.query(convexQueries.getThread, { threadId });
  }

  async touchThreadFollowup(threadId: string, dateIso: string | null) {
    await this.client.mutation(convexMutations.touchThreadFollowup, { threadId, dateIso });
  }

  async saveSandboxTranscript(input: {
    threadId: string;
    stage: LifecycleStage;
    transcript: unknown[];
    outputText: string;
    usage?: Record<string, unknown>;
  }) {
    await this.client.mutation(
      convexMutations.saveSandboxTranscript,
      stripUndefinedDeep(input),
    );
  }

  getCampaignPolicyForProspect(prospectId: string): Promise<CampaignPolicy> {
    return this.client.query(convexQueries.getCampaignPolicyForProspect, { prospectId });
  }
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefinedDeep(item)]),
    ) as T;
  }

  return value;
}
