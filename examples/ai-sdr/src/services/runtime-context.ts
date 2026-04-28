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
import type { ContactEmail, DiscoverySource, ProspectContext } from "../domain/types.js";
import type {
  ConfigurableResearchSearchProvider,
  DiscoverySignalSourceAdapter,
  HandoffProvider,
  OutboundEmailProvider,
  WebExtractProvider,
} from "@ai-sdr/framework";
import {
  createDefaultSdrRepository,
  shouldUseDefaultSdrLocalSmokeMode,
} from "../../../../packages/default-sdr/src/repository-factory.js";
import {
  createDefaultSdrProviderBindings,
  createDefaultSdrSecurity,
  type DefaultSdrCrmProvider,
  type DefaultSdrDiscoveryProvider,
  type DefaultSdrEmailProvider,
  type DefaultSdrEnrichmentProvider,
  type DefaultSdrExtractProvider,
  type DefaultSdrHandoffProvider,
  type DefaultSdrSearchProvider,
} from "../../../../packages/default-sdr/src/runtime-bindings.js";
import type { TrellisRepositoryPort } from "../../../../packages/default-sdr/src/repository-contracts.js";
import { AiStructuredService } from "./ai-service.js";
import { getFrameworkRuntimeConfig, type FrameworkRuntimeConfig } from "./framework-stack.js";
import { KnowledgeService } from "./knowledge-service.js";
import { TrellisMcpToolService } from "./mcp-tools.js";
import { evaluateSendAuthority, shouldHandoff } from "./policy-service.js";
import { createConfiguredStatePlaneProvider } from "./state-plane.js";
import {
  verifyAgentMailWebhook,
  verifyHandoffSignature,
  verifySharedSecretHeader,
} from "./webhook-security.js";
import type { StatePlaneProvider } from "@ai-sdr/framework/state";

export type ActiveSearchProvider = DefaultSdrSearchProvider;
export type ActiveExtractProvider = DefaultSdrExtractProvider;
export type ActiveEnrichmentProvider = DefaultSdrEnrichmentProvider<ProspectContext, ContactEmail>;
export type ActiveDiscoveryProvider = DefaultSdrDiscoveryProvider<DiscoverySource> & DiscoverySignalSourceAdapter<DiscoverySource>;
export type ActiveCrmProvider = DefaultSdrCrmProvider<AttioAdapter>;
export type ActiveEmailProvider = DefaultSdrEmailProvider & OutboundEmailProvider;
export type ActiveHandoffProvider = DefaultSdrHandoffProvider & HandoffProvider;

export interface AppContext {
  config: AppConfig;
  framework: FrameworkRuntimeConfig;
  localSmokeMode: boolean;
  repository: TrellisRepositoryPort;
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
    discovery: ActiveDiscoveryProvider | null;
    search: ActiveSearchProvider;
    extract: ActiveExtractProvider;
    enrichment: ActiveEnrichmentProvider | null;
    crm: ActiveCrmProvider | null;
    email: ActiveEmailProvider | null;
    handoff: ActiveHandoffProvider | null;
  };
  policy: {
    evaluateSendAuthority: typeof evaluateSendAuthority;
    shouldHandoff: typeof shouldHandoff;
  };
  mcpTools: TrellisMcpToolService;
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

  const knowledge = new KnowledgeService();
  const ai = new AiStructuredService();
  const framework = getFrameworkRuntimeConfig();
  const localSmokeMode = shouldUseLocalSmokeMode(config);
  const repository = createRepository({
    config,
    framework,
    localSmokeMode,
  });
  const apify = new ApifySourceAdapter();
  const prospeo = new ProspeoEmailEnricher();
  const parallel = new ParallelResearchAdapter();
  const firecrawl = new FirecrawlExtractAdapter();
  const attio = new AttioAdapter();
  const agentMail = new AgentMailAdapter();
  const slack = new SlackWebhookAdapter();
  const providerBindings = createDefaultSdrProviderBindings<DiscoverySource, ProspectContext, ContactEmail, AttioAdapter>(
    framework,
    {
      apify,
      prospeo,
      parallel,
      firecrawl,
      attio,
      agentMail,
      slack,
    },
  ) as AppContext["providers"];

  const builtContext: AppContext = {
    config,
    framework,
    localSmokeMode,
    repository,
    state: createConfiguredStatePlaneProvider({
      providerId: localSmokeMode ? "disabled" : framework.selections.state.providerId,
      convexUrl: localSmokeMode ? undefined : config.CONVEX_URL ?? config.NEXT_PUBLIC_CONVEX_URL,
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
    providers: providerBindings,
    policy: {
      evaluateSendAuthority,
      shouldHandoff,
    },
    mcpTools: undefined as never,
    security: createDefaultSdrSecurity({
      handoffWebhookSecret: config.HANDOFF_WEBHOOK_SECRET,
      verifySharedSecretHeader,
      verifyAgentMailWebhook,
      verifyHandoffSignature,
    }),
  };

  builtContext.mcpTools = new TrellisMcpToolService(builtContext);
  cachedContext = builtContext;
  return cachedContext;
}

function createRepository(input: {
  config: AppConfig;
  framework: FrameworkRuntimeConfig;
  localSmokeMode: boolean;
}): TrellisRepositoryPort {
  return createDefaultSdrRepository({
    localSmokeMode: input.localSmokeMode,
    defaultCampaignTimezone: input.config.DEFAULT_CAMPAIGN_TIMEZONE,
    stateProviderId: input.framework.selections.state.providerId,
    convexUrl: input.config.CONVEX_URL ?? input.config.NEXT_PUBLIC_CONVEX_URL,
  });
}

export function shouldUseLocalSmokeMode(config: AppConfig) {
  return shouldUseDefaultSdrLocalSmokeMode(config.TRELLIS_LOCAL_SMOKE_MODE);
}

export function resetAppContextForTests() {
  cachedContext = null;
}
