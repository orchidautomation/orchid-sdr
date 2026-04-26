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
    ...findDuplicateIds("webhook", (config.webhooks ?? []).map((webhook) => webhook.id)),
    ...findDuplicateIds("package_boundary", (config.packageBoundaries ?? []).map((boundary) => boundary.id)),
    ...findUnknownCampaignSources(config),
    ...findUnknownWebhookProviders(config),
    ...findProvidersMissingFromConfig(config),
    ...findModulesWithoutContracts(config),
    ...findUnknownCapabilityBindingProviders(config),
    ...findAmbiguousCapabilityDefaults(config),
    ...findCapabilityBindingsWithoutSupportingModules(config),
    ...findUnknownPackageBoundaryReferences(config),
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

function findUnknownWebhookProviders(config: AiSdrConfig): AiSdrConfigIssue[] {
  const providerMap = buildProviderMap(config);

  return (config.webhooks ?? [])
    .filter((webhook) => webhook.providerId && !providerMap.has(webhook.providerId))
    .map((webhook) => ({
      severity: "error" as const,
      code: "unknown_webhook_provider",
      message: `Webhook "${webhook.id}" references provider "${webhook.providerId}", but no provider with that id exists`,
    }));
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

function findUnknownCapabilityBindingProviders(config: AiSdrConfig): AiSdrConfigIssue[] {
  const providerMap = buildProviderMap(config);

  return (config.capabilityBindings ?? [])
    .filter((binding) => !providerMap.has(binding.providerId))
    .map((binding) => ({
      severity: "error" as const,
      code: "unknown_capability_binding_provider",
      message: `Capability binding "${binding.capabilityId}" references provider "${binding.providerId}", but no provider with that id exists`,
    }));
}

function findAmbiguousCapabilityDefaults(config: AiSdrConfig): AiSdrConfigIssue[] {
  const groups = new Map<string, number>();

  for (const binding of config.capabilityBindings ?? []) {
    if (!binding.default) {
      continue;
    }

    const key = [binding.capabilityId, binding.contractId ?? "", binding.purpose ?? ""].join("::");
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return [...groups.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => {
      const [capabilityId, contractId, purpose] = key.split("::");
      const suffix = [contractId || null, purpose || null].filter(Boolean).join(", ");
      return {
        severity: "error" as const,
        code: "duplicate_capability_default",
        message: suffix
          ? `Capability binding "${capabilityId}" has multiple defaults for ${suffix}`
          : `Capability binding "${capabilityId}" has multiple default providers`,
      };
    });
}

function findCapabilityBindingsWithoutSupportingModules(config: AiSdrConfig): AiSdrConfigIssue[] {
  if ((config.modules ?? []).length === 0) {
    return [];
  }

  const providerModuleMap = new Map<string, Array<NonNullable<AiSdrConfig["modules"]>[number]>>();
  for (const module of config.modules ?? []) {
    for (const provider of module.providers ?? []) {
      providerModuleMap.set(provider.id, [...(providerModuleMap.get(provider.id) ?? []), module]);
    }
  }

  return (config.capabilityBindings ?? [])
    .filter((binding) => {
      const supportingModules = (providerModuleMap.get(binding.providerId) ?? []).filter((module) => {
        const capabilitySupported = (module.capabilityIds ?? []).includes(binding.capabilityId);
        const contractSupported = !binding.contractId || (module.contracts ?? []).includes(binding.contractId);
        return capabilitySupported && contractSupported;
      });

      return supportingModules.length === 0;
    })
    .map((binding) => ({
      severity: "error" as const,
      code: "unsupported_capability_binding",
      message: binding.contractId
        ? `Capability binding "${binding.capabilityId}" -> "${binding.providerId}" declares contract "${binding.contractId}", but no module for that provider exposes both the capability and contract`
        : `Capability binding "${binding.capabilityId}" -> "${binding.providerId}" is not backed by any module exposing that capability`,
    }));
}

function findUnknownPackageBoundaryReferences(config: AiSdrConfig): AiSdrConfigIssue[] {
  const moduleIds = new Set((config.modules ?? []).map((module) => module.id));
  const providerIds = new Set((config.providers ?? []).map((provider) => provider.id));
  const issues: AiSdrConfigIssue[] = [];

  for (const boundary of config.packageBoundaries ?? []) {
    for (const moduleId of boundary.moduleIds ?? []) {
      if (!moduleIds.has(moduleId)) {
        issues.push({
          severity: "error",
          code: "unknown_package_boundary_module",
          message: `Package boundary "${boundary.id}" references unknown module "${moduleId}"`,
        });
      }
    }

    for (const providerId of boundary.providerIds ?? []) {
      if (!providerIds.has(providerId)) {
        issues.push({
          severity: "error",
          code: "unknown_package_boundary_provider",
          message: `Package boundary "${boundary.id}" references unknown provider "${providerId}"`,
        });
      }
    }
  }

  return issues;
}
