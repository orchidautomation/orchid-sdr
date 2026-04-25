import { z } from "zod";

export const aiSdrProviderKindSchema = z.enum([
  "crm",
  "email",
  "signal-source",
  "research",
  "model",
  "runtime",
  "mcp",
  "handoff",
]);

export const aiSdrEnvVarSchema = z.object({
  name: z.string().min(1),
  required: z.boolean().optional(),
  description: z.string().optional(),
});

export const aiSdrProviderDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: aiSdrProviderKindSchema,
  displayName: z.string().min(1),
  packageName: z.string().optional(),
  env: z.array(aiSdrEnvVarSchema).optional(),
  capabilities: z.array(z.string().min(1)).optional(),
});

export const aiSdrSkillDefinitionSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  description: z.string().optional(),
});

export const aiSdrKnowledgeDefinitionSchema = z.object({
  product: z.string().min(1),
  icp: z.string().min(1),
  compliance: z.string().optional(),
  usp: z.string().optional(),
  handoff: z.string().optional(),
  negativeSignals: z.string().optional(),
});

export const aiSdrCampaignDefinitionSchema = z.object({
  id: z.string().min(1),
  timezone: z.string().optional(),
  noSendsMode: z.boolean().optional(),
  sources: z.array(z.string().min(1)).optional(),
});

export const aiSdrModuleDocSchema = z.object({
  label: z.string().min(1),
  path: z.string().min(1),
});

export const aiSdrModuleSmokeCheckSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  command: z.string().optional(),
});

export const aiSdrContractIdSchema = z.enum([
  "signal.normalized.v1",
  "signal.webhook.v1",
  "signal.discovery.v1",
  "crm.prospectSync.v1",
  "crm.stageUpdate.v1",
  "email.outbound.v1",
  "email.inbound.v1",
  "research.search.v1",
  "research.extract.v1",
  "model.gateway.v1",
  "runtime.sandbox.v1",
  "mcp.tools.v1",
  "handoff.notify.v1",
]);

export const aiSdrModuleDefinitionSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  packageName: z.string().optional(),
  description: z.string().optional(),
  contracts: z.array(aiSdrContractIdSchema).optional(),
  providers: z.array(aiSdrProviderDefinitionSchema).optional(),
  skills: z.array(aiSdrSkillDefinitionSchema).optional(),
  requiredEnv: z.array(aiSdrEnvVarSchema).optional(),
  docs: z.array(aiSdrModuleDocSchema).optional(),
  smokeChecks: z.array(aiSdrModuleSmokeCheckSchema).optional(),
});

export const aiSdrConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  knowledge: aiSdrKnowledgeDefinitionSchema,
  modules: z.array(aiSdrModuleDefinitionSchema).optional(),
  skills: z.array(aiSdrSkillDefinitionSchema).optional(),
  providers: z.array(aiSdrProviderDefinitionSchema).optional(),
  campaigns: z.array(aiSdrCampaignDefinitionSchema).optional(),
  requiredEnv: z.array(aiSdrEnvVarSchema).optional(),
});

export type AiSdrProviderKind =
  z.infer<typeof aiSdrProviderKindSchema>;
export type AiSdrEnvVar = z.infer<typeof aiSdrEnvVarSchema>;
export type AiSdrProviderDefinition = z.infer<typeof aiSdrProviderDefinitionSchema>;
export type AiSdrSkillDefinition = z.infer<typeof aiSdrSkillDefinitionSchema>;
export type AiSdrKnowledgeDefinition = z.infer<typeof aiSdrKnowledgeDefinitionSchema>;
export type AiSdrCampaignDefinition = z.infer<typeof aiSdrCampaignDefinitionSchema>;
export type AiSdrModuleDoc = z.infer<typeof aiSdrModuleDocSchema>;
export type AiSdrModuleSmokeCheck = z.infer<typeof aiSdrModuleSmokeCheckSchema>;
export type AiSdrContractId = z.infer<typeof aiSdrContractIdSchema>;
export type AiSdrModuleDefinition = z.infer<typeof aiSdrModuleDefinitionSchema>;
export type AiSdrConfig = z.infer<typeof aiSdrConfigSchema>;

export function defineAiSdr(config: AiSdrConfig): AiSdrConfig {
  return aiSdrConfigSchema.parse(config);
}

export function collectConfigEnv(config: AiSdrConfig): AiSdrEnvVar[] {
  const seen = new Map<string, AiSdrEnvVar>();

  for (const envVar of [...(config.requiredEnv ?? []), ...collectModuleEnv(config), ...collectProviderEnv(config)]) {
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

export function collectModuleEnv(config: AiSdrConfig): AiSdrEnvVar[] {
  return (config.modules ?? []).flatMap((module) => [
    ...(module.requiredEnv ?? []),
    ...(module.providers ?? []).flatMap((provider) => provider.env ?? []),
  ]);
}

export function collectModuleDocs(config: AiSdrConfig): AiSdrModuleDoc[] {
  return (config.modules ?? []).flatMap((module) => module.docs ?? []);
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

export function module(
  definition: AiSdrModuleDefinition,
): AiSdrModuleDefinition {
  return aiSdrModuleDefinitionSchema.parse(definition);
}

export function providersFromModules(modules: AiSdrModuleDefinition[]): AiSdrProviderDefinition[] {
  return modules.flatMap((item) => item.providers ?? []);
}

export * from "./signals.js";
export * from "./crm.js";
export * from "./provider-contracts.js";
export * from "./validation.js";
export * from "./builtin-modules.js";
export * from "./install-plan.js";
