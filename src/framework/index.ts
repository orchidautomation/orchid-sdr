export type AiSdrProviderKind =
  | "crm"
  | "email"
  | "signal-source"
  | "research"
  | "model"
  | "runtime"
  | "mcp"
  | "handoff";

export type AiSdrEnvVar = {
  name: string;
  required?: boolean;
  description?: string;
};

export type AiSdrProviderDefinition = {
  id: string;
  kind: AiSdrProviderKind;
  displayName: string;
  packageName?: string;
  env?: AiSdrEnvVar[];
  capabilities?: string[];
};

export type AiSdrSkillDefinition = {
  id: string;
  path: string;
  description?: string;
};

export type AiSdrKnowledgeDefinition = {
  product: string;
  icp: string;
  compliance?: string;
  usp?: string;
  handoff?: string;
  negativeSignals?: string;
};

export type AiSdrCampaignDefinition = {
  id: string;
  timezone?: string;
  noSendsMode?: boolean;
  sources?: string[];
};

export type AiSdrConfig = {
  name: string;
  description?: string;
  knowledge: AiSdrKnowledgeDefinition;
  skills?: AiSdrSkillDefinition[];
  providers?: AiSdrProviderDefinition[];
  campaigns?: AiSdrCampaignDefinition[];
  requiredEnv?: AiSdrEnvVar[];
};

export function defineAiSdr(config: AiSdrConfig): AiSdrConfig {
  return config;
}

export function collectConfigEnv(config: AiSdrConfig): AiSdrEnvVar[] {
  const seen = new Map<string, AiSdrEnvVar>();

  for (const envVar of [...(config.requiredEnv ?? []), ...collectProviderEnv(config)]) {
    const existing = seen.get(envVar.name);
    if (!existing) {
      seen.set(envVar.name, envVar);
      continue;
    }

    seen.set(envVar.name, {
      ...existing,
      ...envVar,
      required: Boolean(existing.required || envVar.required),
      description: existing.description ?? envVar.description,
    });
  }

  return [...seen.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function collectProviderEnv(config: AiSdrConfig): AiSdrEnvVar[] {
  return (config.providers ?? []).flatMap((provider) => provider.env ?? []);
}

export function collectKnowledgePaths(config: AiSdrConfig): string[] {
  return Object.values(config.knowledge).filter((value): value is string => Boolean(value));
}

export function collectSkillPaths(config: AiSdrConfig): string[] {
  return (config.skills ?? []).map((skill) => skill.path);
}

export function provider(
  definition: AiSdrProviderDefinition,
): AiSdrProviderDefinition {
  return definition;
}

export * from "./signals.js";
export * from "./provider-contracts.js";
