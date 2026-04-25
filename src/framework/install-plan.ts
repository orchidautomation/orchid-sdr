import type { AiSdrCapabilityId, AiSdrModuleDefinition } from "./index.js";

export type AiSdrModuleInstallPlan = {
  moduleId: string;
  displayName: string;
  packageName: string | null;
  alreadyInstalled: boolean;
  providerKey: string | null;
  capabilityIds: string[];
  contracts: string[];
  providers: string[];
  envVars: string[];
  docs: string[];
  smokeChecks: string[];
  nextSteps: string[];
};

export function buildModuleInstallPlan(
  module: AiSdrModuleDefinition,
  input: {
    installedModuleIds?: string[];
  } = {},
): AiSdrModuleInstallPlan {
  const installed = new Set(input.installedModuleIds ?? []);
  const alreadyInstalled = installed.has(module.id);
  const envVars = [
    ...(module.requiredEnv ?? []),
    ...(module.providers ?? []).flatMap((provider) => provider.env ?? []),
  ].map((envVar) => envVar.name);

  return {
    moduleId: module.id,
    displayName: module.displayName,
    packageName: module.packageName ?? null,
    alreadyInstalled,
    providerKey: module.providerKey ?? null,
    capabilityIds: module.capabilityIds ?? [],
    contracts: module.contracts ?? [],
    providers: (module.providers ?? []).map((provider) => provider.id),
    envVars: [...new Set(envVars)].sort(),
    docs: (module.docs ?? []).map((doc) => `${doc.label}: ${doc.path}`),
    smokeChecks: (module.smokeChecks ?? []).map((check) =>
      check.command ? `${check.id}: ${check.command}` : check.id,
    ),
    nextSteps: buildNextSteps(module, alreadyInstalled),
  };
}

export function findModuleForAddCommand(
  modules: AiSdrModuleDefinition[],
  input: {
    capabilityOrModule: string;
    provider?: string;
  },
): AiSdrModuleDefinition | undefined {
  const capabilityOrModule = normalizeAddToken(input.capabilityOrModule);
  const provider = input.provider ? normalizeAddToken(input.provider) : undefined;

  if (!provider) {
    return modules.find((module) => normalizeAddToken(module.id) === capabilityOrModule);
  }

  const capabilities = new Set(normalizeCapabilities(capabilityOrModule));
  return modules.find((module) => {
    const moduleProviderKeys = new Set([
      module.id,
      module.providerKey,
      ...(module.providers ?? []).map((item) => item.id),
    ].filter((value): value is string => Boolean(value)).map(normalizeAddToken));

    return (
      module.capabilityIds?.some((capability) => capabilities.has(capability))
      && moduleProviderKeys.has(provider)
    );
  });
}

function buildNextSteps(module: AiSdrModuleDefinition, alreadyInstalled: boolean) {
  if (alreadyInstalled) {
    return [
      `Module "${module.id}" is already present in ai-sdr.config.ts.`,
      "Review env values and run npm run doctor.",
    ];
  }

  return [
    module.packageName
      ? `Install ${module.packageName} once packages are extracted.`
      : `Register module "${module.id}" in ai-sdr.config.ts.`,
    `Add provider definitions for: ${(module.providers ?? []).map((provider) => provider.id).join(", ") || "none"}.`,
    "Copy required env vars into .env.example and deployment secrets.",
    "Run npm run doctor.",
    "Run the module smoke checks before enabling sends.",
  ];
}

function normalizeCapabilities(value: string): AiSdrCapabilityId[] {
  switch (normalizeAddToken(value)) {
    case "research":
    case "deep-research":
    case "deepresearch":
      return ["search", "extract", "enrichment"];
    case "extract":
    case "extraction":
      return ["extract"];
    case "enrich":
    case "enrichment":
      return ["enrichment"];
    case "monitor":
    case "monitoring":
      return ["source", "observability"];
    case "postgres":
    case "storage":
    case "db":
      return ["database"];
    case "discovery":
    case "signal":
    case "signals":
      return ["source"];
    case "mail":
    case "outreach":
      return ["email"];
    default:
      return [normalizeAddToken(value) as AiSdrCapabilityId];
  }
}

function normalizeAddToken(value: string) {
  return value.trim().toLowerCase();
}
