import crypto from "node:crypto";

import {
  AttioAdapter,
  AgentMailAdapter,
  ApifySourceAdapter,
  FirecrawlExtractAdapter,
  ParallelResearchAdapter,
  ProspeoEmailEnricher,
  SlackWebhookAdapter,
} from "../adapters.js";
import { getConfig, type AppConfig } from "../config.js";
import type { ContactEmail, ProspectContext } from "../domain/types.js";
import type {
  ConfigurableResearchSearchProvider,
  HandoffProvider,
  OutboundEmailProvider,
  WebExtractProvider,
} from "../framework/index.js";
import { OrchidRepository } from "../repository.js";
import { AiStructuredService } from "./ai-service.js";
import { getFrameworkRuntimeConfig, type FrameworkRuntimeConfig } from "./framework-stack.js";
import { KnowledgeService } from "./knowledge-service.js";
import { OrchidMcpToolService } from "./mcp-tools.js";
import { evaluateSendAuthority, shouldHandoff } from "./policy-service.js";
import { createConfiguredStatePlaneProvider } from "./state-plane.js";
import {
  verifyAgentMailWebhook,
  verifyHandoffSignature,
  verifySharedSecretHeader,
} from "./webhook-security.js";
import type { StatePlaneProvider } from "../framework/state.js";

export interface ActiveSearchProvider {
  providerId: string;
  search(query: string, input?: {
    limit?: number;
    sources?: Array<"web" | "news">;
    tbs?: string;
  }): Promise<Array<{
    title: string;
    url: string;
    excerpt: string;
  }>>;
}

export interface ActiveExtractProvider {
  providerId: string;
  extract: WebExtractProvider["extract"];
  searchCompanyNews(company: string | null, domain: string | null, limit?: number): Promise<Array<{
    title: string;
    url: string;
    excerpt: string;
  }>>;
}

export interface ActiveEnrichmentProvider {
  providerId: string;
  enrich(prospect: ProspectContext): Promise<ContactEmail | null>;
}

export interface ActiveCrmProvider {
  providerId: string;
  isConfigured(): boolean;
  adapter: AttioAdapter;
}

export interface ActiveEmailProvider extends OutboundEmailProvider {
  providerId: string;
}

export interface ActiveHandoffProvider extends HandoffProvider {
  providerId: string;
}

export interface AppContext {
  config: AppConfig;
  framework: FrameworkRuntimeConfig;
  repository: OrchidRepository;
  state: StatePlaneProvider;
  knowledge: KnowledgeService;
  ai: AiStructuredService;
  apify: ApifySourceAdapter;
  prospeo: ProspeoEmailEnricher;
  parallel: ParallelResearchAdapter;
  firecrawl: FirecrawlExtractAdapter;
  attio: AttioAdapter;
  agentMail: AgentMailAdapter;
  slack: SlackWebhookAdapter;
  providers: {
    search: ActiveSearchProvider;
    extract: ActiveExtractProvider;
    enrichment: ActiveEnrichmentProvider;
    crm: ActiveCrmProvider | null;
    email: ActiveEmailProvider | null;
    handoff: ActiveHandoffProvider | null;
  };
  policy: {
    evaluateSendAuthority: typeof evaluateSendAuthority;
    shouldHandoff: typeof shouldHandoff;
  };
  mcpTools: OrchidMcpToolService;
  security: {
    verifySharedSecretHeader: typeof verifySharedSecretHeader;
    verifyAgentMailWebhook: typeof verifyAgentMailWebhook;
    verifyHandoffSignature: typeof verifyHandoffSignature;
    signHandoffBody: (body: string) => string;
  };
}

let cachedContext: AppContext | null = null;

export function getAppContext(): AppContext {
  if (cachedContext) {
    return cachedContext;
  }

  const config = getConfig();
  if (config.gatewayApiKey && !process.env.AI_GATEWAY_API_KEY) {
    process.env.AI_GATEWAY_API_KEY = config.gatewayApiKey;
  }

  const repository = new OrchidRepository();
  const knowledge = new KnowledgeService();
  const ai = new AiStructuredService();
  const framework = getFrameworkRuntimeConfig();
  const apify = new ApifySourceAdapter();
  const prospeo = new ProspeoEmailEnricher();
  const parallel = new ParallelResearchAdapter();
  const firecrawl = new FirecrawlExtractAdapter();
  const attio = new AttioAdapter();
  const agentMail = new AgentMailAdapter();
  const slack = new SlackWebhookAdapter();

  cachedContext = {
    config,
    framework,
    repository,
    state: createConfiguredStatePlaneProvider({
      providerId: framework.selections.state.providerId,
      convexUrl: config.CONVEX_URL ?? config.NEXT_PUBLIC_CONVEX_URL,
    }),
    knowledge,
    ai,
    apify,
    prospeo,
    parallel,
    firecrawl,
    attio,
    agentMail,
    slack,
    providers: {
      search: createActiveSearchProvider(framework, { parallel, firecrawl }),
      extract: createActiveExtractProvider(framework, { firecrawl }),
      enrichment: createActiveEnrichmentProvider(framework, { prospeo }),
      crm: createActiveCrmProvider(framework, { attio }),
      email: createActiveEmailProvider(framework, { agentMail }),
      handoff: createActiveHandoffProvider(framework, { slack }),
    },
    policy: {
      evaluateSendAuthority,
      shouldHandoff,
    },
    mcpTools: undefined as never,
    security: {
      verifySharedSecretHeader,
      verifyAgentMailWebhook,
      verifyHandoffSignature,
      signHandoffBody(body: string) {
        return crypto.createHmac("sha256", config.HANDOFF_WEBHOOK_SECRET).update(body).digest("hex");
      },
    },
  };

  cachedContext.mcpTools = new OrchidMcpToolService(cachedContext);
  return cachedContext;
}

function createActiveSearchProvider(
  framework: FrameworkRuntimeConfig,
  adapters: {
    parallel: ParallelResearchAdapter;
    firecrawl: FirecrawlExtractAdapter;
  },
): ActiveSearchProvider {
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

function createActiveExtractProvider(
  framework: FrameworkRuntimeConfig,
  adapters: {
    firecrawl: FirecrawlExtractAdapter;
  },
): ActiveExtractProvider {
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

function createActiveEnrichmentProvider(
  framework: FrameworkRuntimeConfig,
  adapters: {
    prospeo: ProspeoEmailEnricher;
  },
): ActiveEnrichmentProvider {
  switch (framework.selections.enrichment.providerId) {
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

function createActiveCrmProvider(
  framework: FrameworkRuntimeConfig,
  adapters: {
    attio: AttioAdapter;
  },
): ActiveCrmProvider | null {
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

function createActiveEmailProvider(
  framework: FrameworkRuntimeConfig,
  adapters: {
    agentMail: AgentMailAdapter;
  },
): ActiveEmailProvider | null {
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

function createActiveHandoffProvider(
  framework: FrameworkRuntimeConfig,
  adapters: {
    slack: SlackWebhookAdapter;
  },
): ActiveHandoffProvider | null {
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
