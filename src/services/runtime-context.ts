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
import { OrchidRepository } from "../repository.js";
import { AiStructuredService } from "./ai-service.js";
import { KnowledgeService } from "./knowledge-service.js";
import { OrchidMcpToolService } from "./mcp-tools.js";
import { evaluateSendAuthority, shouldHandoff } from "./policy-service.js";
import { createDefaultStatePlaneProvider } from "./state-plane.js";
import {
  verifyAgentMailWebhook,
  verifyHandoffSignature,
  verifySharedSecretHeader,
} from "./webhook-security.js";
import type { StatePlaneProvider } from "../framework/state.js";

export interface AppContext {
  config: AppConfig;
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

  cachedContext = {
    config,
    repository,
    state: createDefaultStatePlaneProvider({
      convexUrl: config.CONVEX_URL ?? config.NEXT_PUBLIC_CONVEX_URL,
    }),
    knowledge,
    ai,
    apify: new ApifySourceAdapter(),
    prospeo: new ProspeoEmailEnricher(),
    parallel: new ParallelResearchAdapter(),
    firecrawl: new FirecrawlExtractAdapter(),
    attio: new AttioAdapter(),
    agentMail: new AgentMailAdapter(),
    slack: new SlackWebhookAdapter(),
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
