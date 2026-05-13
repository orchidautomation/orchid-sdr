import { ConvexHttpClient } from "convex/browser";

import { getConfig, type AppConfig } from "../config.js";
import { ConvexMeetingPrepRepository } from "../repository-convex.js";
import type { MeetingPrepRepository } from "../repository.js";
import { AiStructuredService } from "./ai-service.js";
import { getFrameworkRuntimeConfig, type FrameworkRuntimeConfig } from "./framework-stack.js";
import { KnowledgeService } from "./knowledge-service.js";
import { TrellisCoreMcpToolService } from "./mcp-tools.js";
import { verifySharedSecretHeader } from "./webhook-security.js";

export interface AppContext {
  config: AppConfig;
  framework: FrameworkRuntimeConfig;
  repository: MeetingPrepRepository;
  knowledge: KnowledgeService;
  ai: AiStructuredService;
  mcpTools: TrellisCoreMcpToolService;
  security: {
    verifySharedSecretHeader: typeof verifySharedSecretHeader;
  };
}

let cachedContext: AppContext | null = null;

export function getAppContext(): AppContext {
  if (cachedContext) {
    return cachedContext;
  }

  const config = getConfig();
  const framework = getFrameworkRuntimeConfig();
  const client = new ConvexHttpClient(config.CONVEX_URL ?? config.NEXT_PUBLIC_CONVEX_URL ?? "");
  const repository = new ConvexMeetingPrepRepository(client);
  const knowledge = new KnowledgeService();
  const ai = new AiStructuredService();

  const context: AppContext = {
    config,
    framework,
    repository,
    knowledge,
    ai,
    mcpTools: undefined as never,
    security: {
      verifySharedSecretHeader,
    },
  };
  context.mcpTools = new TrellisCoreMcpToolService(context);
  cachedContext = context;
  return context;
}

export function resetAppContextForTests() {
  cachedContext = null;
}
