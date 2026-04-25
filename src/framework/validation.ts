import type { AiSdrConfig } from "./index.js";

export type AiSdrConfigIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export function validateAiSdrConfigReferences(config: AiSdrConfig): AiSdrConfigIssue[] {
  return [
    ...findDuplicateIds("module", (config.modules ?? []).map((module) => module.id)),
    ...findDuplicateIds("provider", (config.providers ?? []).map((provider) => provider.id)),
    ...findDuplicateIds(
      "module_provider",
      (config.modules ?? []).flatMap((module) => module.providers ?? []).map((provider) => provider.id),
    ),
    ...findDuplicateIds("skill", (config.skills ?? []).map((skill) => skill.id)),
    ...findDuplicateIds("campaign", (config.campaigns ?? []).map((campaign) => campaign.id)),
    ...findUnknownCampaignSources(config),
    ...findProvidersMissingFromConfig(config),
    ...findModulesWithoutContracts(config),
  ];
}

export function buildProviderMap(config: AiSdrConfig) {
  return new Map((config.providers ?? []).map((provider) => [provider.id, provider] as const));
}

export function requireConfigWithoutErrors(config: AiSdrConfig) {
  const issues = validateAiSdrConfigReferences(config);
  const errors = issues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(errors.map((issue) => issue.message).join("; "));
  }
  return config;
}

function findDuplicateIds(kind: string, ids: string[]): AiSdrConfigIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }

  return [...duplicates].map((id) => ({
    severity: "error" as const,
    code: `duplicate_${kind}_id`,
    message: `Duplicate ${kind} id "${id}"`,
  }));
}

function findUnknownCampaignSources(config: AiSdrConfig): AiSdrConfigIssue[] {
  const providerMap = buildProviderMap(config);
  const issues: AiSdrConfigIssue[] = [];

  for (const campaign of config.campaigns ?? []) {
    for (const source of campaign.sources ?? []) {
      if (!providerMap.has(source)) {
        issues.push({
          severity: "error",
          code: "unknown_campaign_source",
          message: `Campaign "${campaign.id}" references source provider "${source}", but no provider with that id exists`,
        });
      }
    }
  }

  return issues;
}

function findProvidersMissingFromConfig(config: AiSdrConfig): AiSdrConfigIssue[] {
  const configuredProviders = buildProviderMap(config);
  const issues: AiSdrConfigIssue[] = [];

  for (const module of config.modules ?? []) {
    for (const provider of module.providers ?? []) {
      if (!configuredProviders.has(provider.id)) {
        issues.push({
          severity: "warning",
          code: "module_provider_not_registered",
          message: `Module "${module.id}" defines provider "${provider.id}", but config.providers does not include it`,
        });
      }
    }
  }

  return issues;
}

function findModulesWithoutContracts(config: AiSdrConfig): AiSdrConfigIssue[] {
  return (config.modules ?? [])
    .filter((module) => (module.contracts ?? []).length === 0)
    .map((module) => ({
      severity: "warning" as const,
      code: "module_without_contracts",
      message: `Module "${module.id}" does not declare any normalized framework contracts`,
    }));
}
