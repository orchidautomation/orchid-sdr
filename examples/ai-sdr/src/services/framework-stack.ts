import frameworkConfig from "../../ai-sdr.config.js";
import {
  collectPackageBoundaries,
  requireConfigWithoutErrors,
  resolveProviderForCapability,
  type AiSdrConfig,
  type AiSdrPackageBoundary,
  type AiSdrProviderDefinition,
} from "@ai-sdr/framework";

export type FrameworkProviderSelection = {
  providerId: string | null;
  provider: AiSdrProviderDefinition | null;
};

export type FrameworkStackSelections = {
  state: FrameworkProviderSelection;
  database: FrameworkProviderSelection;
  crm: FrameworkProviderSelection;
  email: FrameworkProviderSelection;
  sourceWarmInbound: FrameworkProviderSelection;
  sourceDiscovery: FrameworkProviderSelection;
  search: FrameworkProviderSelection;
  extract: FrameworkProviderSelection;
  deepResearch: FrameworkProviderSelection;
  monitor: FrameworkProviderSelection;
  enrichment: FrameworkProviderSelection;
  handoff: FrameworkProviderSelection;
  model: FrameworkProviderSelection;
  runtimeActor: FrameworkProviderSelection;
  runtimeSandbox: FrameworkProviderSelection;
  mcp: FrameworkProviderSelection;
};

export type FrameworkRuntimeConfig = {
  config: AiSdrConfig;
  packageBoundaries: AiSdrPackageBoundary[];
  selections: FrameworkStackSelections;
};

let cachedFrameworkRuntimeConfig: FrameworkRuntimeConfig | null = null;

export function getFrameworkRuntimeConfig(): FrameworkRuntimeConfig {
  if (cachedFrameworkRuntimeConfig) {
    return cachedFrameworkRuntimeConfig;
  }

  const config = requireConfigWithoutErrors(frameworkConfig);
  cachedFrameworkRuntimeConfig = {
    config,
    packageBoundaries: collectPackageBoundaries(config),
    selections: {
      state: pickProvider(config, "state"),
      database: pickProvider(config, "database", "database.postgres.v1"),
      crm: pickProvider(config, "crm"),
      email: pickProvider(config, "email"),
      sourceWarmInbound: pickProvider(config, "source", "signal.webhook.v1"),
      sourceDiscovery: pickProvider(config, "source", "signal.discovery.v1"),
      search: pickProvider(config, "search"),
      extract: pickProvider(config, "extract"),
      deepResearch: pickProvider(config, "search", "research.deepResearch.v1"),
      monitor: pickProvider(config, "observability", "research.monitor.v1"),
      enrichment: pickProvider(config, "enrichment"),
      handoff: pickProvider(config, "handoff"),
      model: pickProvider(config, "model", "model.gateway.v1"),
      runtimeActor: pickProvider(config, "runtime", "runtime.actor.v1"),
      runtimeSandbox: pickProvider(config, "runtime", "runtime.sandbox.v1"),
      mcp: pickProvider(config, "mcp", "mcp.tools.v1"),
    },
  };
  return cachedFrameworkRuntimeConfig;
}

function pickProvider(
  config: AiSdrConfig,
  capabilityId: Parameters<typeof resolveProviderForCapability>[1]["capabilityId"],
  contractId?: Parameters<typeof resolveProviderForCapability>[1]["contractId"],
): FrameworkProviderSelection {
  const provider = resolveProviderForCapability(config, { capabilityId, contractId });
  return {
    providerId: provider?.id ?? null,
    provider,
  };
}
