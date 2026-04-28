import crypto from "node:crypto";

export interface DefaultSdrFrameworkSelection {
  providerId: string | null;
}

export interface DefaultSdrFrameworkSelections {
  state: DefaultSdrFrameworkSelection;
  crm: DefaultSdrFrameworkSelection;
  email: DefaultSdrFrameworkSelection;
  sourceDiscovery: DefaultSdrFrameworkSelection;
  search: DefaultSdrFrameworkSelection;
  extract: DefaultSdrFrameworkSelection;
  enrichment: DefaultSdrFrameworkSelection;
  handoff: DefaultSdrFrameworkSelection;
}

export interface DefaultSdrFrameworkConfig {
  selections: DefaultSdrFrameworkSelections;
}

export interface DefaultSdrSearchProvider {
  providerId: string;
  search(
    query: string,
    input?: { limit?: number; sources?: Array<"web" | "news">; tbs?: string },
  ): Promise<Array<{ title: string; url: string; excerpt: string }>>;
}

export interface DefaultSdrExtractProvider {
  providerId: string;
  extract(url: string): Promise<unknown>;
  searchCompanyNews(
    company: string | null,
    domain: string | null,
    limit?: number,
  ): Promise<Array<{ title: string; url: string; excerpt: string }>>;
}

export interface DefaultSdrEnrichmentProvider<Prospect, Email> {
  providerId: string;
  enrich(prospect: Prospect): Promise<Email | null>;
}

export interface DefaultSdrDiscoveryProvider<DiscoverySource> {
  providerId: string;
  hasDiscoveryTarget(source: DiscoverySource): boolean;
  fetchDatasetItems(datasetId: string, source: DiscoverySource): Promise<Record<string, unknown>[]>;
  startDiscoveryRun(input: unknown): Promise<unknown>;
  getRun(actorRunId: string): Promise<unknown>;
  normalizeSignals(source: DiscoverySource, items: Record<string, unknown>[]): Array<Record<string, unknown>>;
}

export interface DefaultSdrCrmProvider<Adapter> {
  providerId: string;
  isConfigured(): boolean;
  adapter: Adapter;
}

export interface DefaultSdrEmailProvider {
  providerId: string;
  isConfigured(): boolean;
  createInbox(input: unknown): Promise<any>;
  getInbox(inboxId: string): Promise<any>;
  send(input: unknown): Promise<any>;
  reply(input: unknown): Promise<any>;
  getMessage(inboxId: string, messageId: string): Promise<{ bodyText: string | null } | null>;
}

export interface DefaultSdrHandoffProvider {
  providerId: string;
  notify(channel: string, text: string, metadata?: Record<string, unknown>): Promise<unknown>;
}

export interface DefaultSdrBindingsResult<DiscoverySource, Prospect, Email, CrmAdapter> {
  discovery: DefaultSdrDiscoveryProvider<DiscoverySource> | null;
  search: DefaultSdrSearchProvider;
  extract: DefaultSdrExtractProvider;
  enrichment: DefaultSdrEnrichmentProvider<Prospect, Email> | null;
  crm: DefaultSdrCrmProvider<CrmAdapter> | null;
  email: DefaultSdrEmailProvider | null;
  handoff: DefaultSdrHandoffProvider | null;
}

export function createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: {
    apify: {
      hasDiscoveryTarget(source: DiscoverySource): boolean;
      fetchDatasetItems(datasetId: string, source: DiscoverySource): Promise<Record<string, unknown>[]>;
      startDiscoveryRun(input: unknown): Promise<unknown>;
      getRun(actorRunId: string): Promise<unknown>;
      normalizeSignals(source: DiscoverySource, items: Record<string, unknown>[]): Array<Record<string, unknown>>;
    };
    parallel: {
      search(
        query: string,
        limit?: number,
      ): Promise<Array<{ title: string; url: string; excerpt: string }>>;
    };
    firecrawl: {
      search(
        query: string,
        input?: { limit?: number; sources?: Array<"web" | "news">; tbs?: string },
      ): Promise<Array<{ title: string; url: string; excerpt: string }>>;
      extract(url: string): Promise<unknown>;
      searchCompanyNews(
        company: string | null,
        domain: string | null,
        limit?: number,
      ): Promise<Array<{ title: string; url: string; excerpt: string }>>;
    };
    prospeo: {
      enrich(prospect: Prospect): Promise<Email | null>;
    };
    attio: CrmAdapter & {
      isConfigured(): boolean;
    };
    agentMail: {
      isConfigured(): boolean;
      createInbox(input: unknown): Promise<unknown>;
      getInbox(inboxId: string): Promise<unknown>;
      send(input: unknown): Promise<unknown>;
      reply(input: unknown): Promise<unknown>;
      getMessage(inboxId: string, messageId: string): Promise<{ bodyText: string | null } | null>;
    };
    slack: {
      notify(channel: string, text: string, metadata?: Record<string, unknown>): Promise<unknown>;
    };
  },
): DefaultSdrBindingsResult<DiscoverySource, Prospect, Email, CrmAdapter> {
  return {
    discovery: createDiscoveryProvider(framework, adapters),
    search: createSearchProvider(framework, adapters),
    extract: createExtractProvider(framework, adapters),
    enrichment: createEnrichmentProvider(framework, adapters),
    crm: createCrmProvider(framework, adapters),
    email: createEmailProvider(framework, adapters),
    handoff: createHandoffProvider(framework, adapters),
  };
}

export function createDefaultSdrSecurity(input: {
  handoffWebhookSecret: string;
  verifySharedSecretHeader: (headerValue: string | null, expected: string | undefined) => boolean;
  verifyAgentMailWebhook: (body: string, headers: Record<string, string | undefined>) => boolean;
  verifyHandoffSignature: (body: string, signature: string | null) => boolean;
}) {
  return {
    verifySharedSecretHeader: input.verifySharedSecretHeader,
    verifyAgentMailWebhook: input.verifyAgentMailWebhook,
    verifyHandoffSignature: input.verifyHandoffSignature,
    signHandoffBody(body: string) {
      return crypto.createHmac("sha256", input.handoffWebhookSecret).update(body).digest("hex");
    },
  };
}

function createDiscoveryProvider<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: Parameters<typeof createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>>[1],
): DefaultSdrDiscoveryProvider<DiscoverySource> | null {
  switch (framework.selections.sourceDiscovery.providerId) {
    case null:
      return null;
    case "apify-linkedin":
      return {
        providerId: "apify-linkedin",
        hasDiscoveryTarget(source) {
          return adapters.apify.hasDiscoveryTarget(source);
        },
        fetchDatasetItems(datasetId, source) {
          return adapters.apify.fetchDatasetItems(datasetId, source);
        },
        startDiscoveryRun(input) {
          return adapters.apify.startDiscoveryRun(input);
        },
        getRun(actorRunId) {
          return adapters.apify.getRun(actorRunId);
        },
        normalizeSignals(source, items) {
          return adapters.apify.normalizeSignals(source, items);
        },
      };
    default:
      throw new Error(`unsupported configured discovery provider: ${framework.selections.sourceDiscovery.providerId}`);
  }
}

function createSearchProvider<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: Parameters<typeof createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>>[1],
): DefaultSdrSearchProvider {
  switch (framework.selections.search.providerId) {
    case "parallel":
      return {
        providerId: "parallel",
        search(query, input) {
          return adapters.parallel.search(query, input?.limit ?? 5);
        },
      };
    case "firecrawl":
      return {
        providerId: "firecrawl",
        search(query, input) {
          return adapters.firecrawl.search(query, input);
        },
      };
    default:
      throw new Error(`unsupported configured search provider: ${framework.selections.search.providerId ?? "none"}`);
  }
}

function createExtractProvider<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: Parameters<typeof createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>>[1],
): DefaultSdrExtractProvider {
  switch (framework.selections.extract.providerId) {
    case "firecrawl":
      return {
        providerId: "firecrawl",
        extract(url) {
          return adapters.firecrawl.extract(url);
        },
        searchCompanyNews(company, domain, limit = 3) {
          return adapters.firecrawl.searchCompanyNews(company, domain, limit);
        },
      };
    default:
      throw new Error(`unsupported configured extract provider: ${framework.selections.extract.providerId ?? "none"}`);
  }
}

function createEnrichmentProvider<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: Parameters<typeof createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>>[1],
): DefaultSdrEnrichmentProvider<Prospect, Email> | null {
  switch (framework.selections.enrichment.providerId) {
    case null:
      return null;
    case "prospeo":
      return {
        providerId: "prospeo",
        enrich(prospect) {
          return adapters.prospeo.enrich(prospect);
        },
      };
    default:
      throw new Error(`unsupported configured enrichment provider: ${framework.selections.enrichment.providerId ?? "none"}`);
  }
}

function createCrmProvider<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: Parameters<typeof createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>>[1],
): DefaultSdrCrmProvider<CrmAdapter> | null {
  switch (framework.selections.crm.providerId) {
    case null:
      return null;
    case "attio":
      return {
        providerId: "attio",
        isConfigured() {
          return adapters.attio.isConfigured();
        },
        adapter: adapters.attio,
      };
    default:
      throw new Error(`unsupported configured CRM provider: ${framework.selections.crm.providerId}`);
  }
}

function createEmailProvider<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: Parameters<typeof createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>>[1],
): DefaultSdrEmailProvider | null {
  switch (framework.selections.email.providerId) {
    case null:
      return null;
    case "agentmail":
      return {
        providerId: "agentmail",
        isConfigured() {
          return adapters.agentMail.isConfigured();
        },
        createInbox(input) {
          return adapters.agentMail.createInbox(input);
        },
        getInbox(inboxId) {
          return adapters.agentMail.getInbox(inboxId);
        },
        send(input) {
          return adapters.agentMail.send(input);
        },
        reply(input) {
          return adapters.agentMail.reply(input);
        },
        getMessage(inboxId, messageId) {
          return adapters.agentMail.getMessage(inboxId, messageId);
        },
      };
    default:
      throw new Error(`unsupported configured email provider: ${framework.selections.email.providerId}`);
  }
}

function createHandoffProvider<DiscoverySource, Prospect, Email, CrmAdapter>(
  framework: DefaultSdrFrameworkConfig,
  adapters: Parameters<typeof createDefaultSdrProviderBindings<DiscoverySource, Prospect, Email, CrmAdapter>>[1],
): DefaultSdrHandoffProvider | null {
  switch (framework.selections.handoff.providerId) {
    case null:
      return null;
    case "slack-handoff":
      return {
        providerId: "slack-handoff",
        notify(channel, text, metadata) {
          return adapters.slack.notify(channel, text, metadata);
        },
      };
    default:
      throw new Error(`unsupported configured handoff provider: ${framework.selections.handoff.providerId}`);
  }
}
