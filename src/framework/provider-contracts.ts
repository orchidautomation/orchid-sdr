import type { ProviderSignal } from "./signals.js";
import type {
  CrmProspectSyncRequest,
  CrmProspectSyncResult,
  CrmStageUpdateRequest,
  CrmStageUpdateResult,
} from "./crm.js";

export interface ConfigurableProvider {
  isConfigured(): boolean;
}

export interface DiscoveryRunInput<Source extends string = string> {
  campaignId: string;
  source: Source;
  term: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoveryRunHandle {
  actorRunId: string;
  defaultDatasetId?: string | null;
  raw: Record<string, unknown>;
}

export interface DiscoveryRunSnapshot {
  actorRunId: string;
  status: string;
  defaultDatasetId: string | null;
}

export interface DiscoverySignalSourceAdapter<Source extends string = string> {
  hasDiscoveryTarget(source: Source): boolean;
  fetchDatasetItems(datasetId: string, source: Source): Promise<Record<string, unknown>[]>;
  startDiscoveryRun(input: DiscoveryRunInput<Source>): Promise<DiscoveryRunHandle>;
  getRun(actorRunId: string): Promise<DiscoveryRunSnapshot>;
  abortRun?(actorRunId: string): Promise<DiscoveryRunSnapshot>;
  normalizeSignals(source: Source, items: Record<string, unknown>[]): ProviderSignal[];
}

export interface EmailContact {
  address: string;
  confidence: number;
  source: string;
}

export interface EmailEnrichmentProvider<Prospect = unknown> {
  enrich(prospect: Prospect): Promise<EmailContact | null>;
}

export interface ResearchSearchResult {
  title: string;
  url: string;
  excerpt: string;
}

export interface BasicResearchSearchProvider {
  search(query: string, limit?: number): Promise<ResearchSearchResult[]>;
}

export interface ResearchSearchInput {
  limit?: number;
  sources?: Array<"web" | "news">;
  tbs?: string;
}

export interface ConfigurableResearchSearchProvider {
  search(query: string, input?: ResearchSearchInput): Promise<ResearchSearchResult[]>;
}

export interface WebExtractResult {
  url: string;
  markdown: string;
}

export interface WebExtractProvider {
  extract(url: string): Promise<WebExtractResult>;
}

export interface CrmProvider extends ConfigurableProvider {}

export interface ProspectCrmProvider extends CrmProvider {
  providerId: string;
  syncProspect(input: CrmProspectSyncRequest): Promise<CrmProspectSyncResult>;
  updateStage?(input: CrmStageUpdateRequest): Promise<CrmStageUpdateResult>;
}

export interface EmailInboxReference {
  providerInboxId: string | null;
  email: string | null;
  displayName: string | null;
  raw: Record<string, unknown>;
}

export interface EmailSendInput {
  inboxId: string;
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
}

export interface EmailReplyInput {
  inboxId: string;
  messageId: string;
  bodyText: string;
  bodyHtml?: string | null;
  subject?: string | null;
  replyAll?: boolean;
}

export interface EmailSendResult {
  providerMessageId: string | null;
  providerThreadId: string | null;
  providerInboxId: string;
  raw: Record<string, unknown>;
}

export interface InboundEmailMessage {
  providerInboxId: string | null;
  providerThreadId: string | null;
  providerMessageId: string | null;
  subject: string | null;
  bodyText: string;
  bodyHtml: string | null;
  raw: Record<string, unknown>;
}

export interface OutboundEmailProvider extends ConfigurableProvider {
  createInbox(input: {
    displayName?: string | null;
    clientId?: string | null;
    username?: string | null;
    domain?: string | null;
  }): Promise<EmailInboxReference>;
  getInbox(inboxId: string): Promise<EmailInboxReference>;
  send(input: EmailSendInput): Promise<EmailSendResult>;
  reply(input: EmailReplyInput): Promise<EmailSendResult>;
  getMessage(inboxId: string, messageId: string): Promise<InboundEmailMessage>;
}

export interface HandoffProvider {
  notify(channel: string | undefined, text: string, metadata: Record<string, unknown>): Promise<{
    status: string;
    reason?: string;
  }>;
}
