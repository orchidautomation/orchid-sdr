import type {
  AiSdrCapabilityId,
  AiSdrContractId,
  AiSdrModuleDefinition,
} from "./index.js";

export type AiSdrModuleInstallPlan = {
  moduleId: string;
  displayName: string;
  packageName: string | null;
  alreadyInstalled: boolean;
  providerKey: string | null;
  capabilityIds: string[];
  contracts: string[];
  providers: string[];
  mcpServers: string[];
  mcpTools: string[];
  envVars: string[];
  docs: string[];
  smokeChecks: string[];
  nextSteps: string[];
};

type AddSelector = {
  capabilityIds: AiSdrCapabilityId[];
  contractIds: AiSdrContractId[];
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
    ...(module.mcpServers ?? []).flatMap((server) => [
      ...(server.requiredEnv ?? []),
      ...(server.optionalEnv ?? []),
    ]),
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
    mcpServers: (module.mcpServers ?? []).map((server) =>
      server.url ? `${server.id}: ${server.url}` : server.id,
    ),
    mcpTools: (module.mcpServers ?? []).flatMap((server) =>
      (server.tools ?? []).map((tool) => `${server.id}.${tool.name}: ${tool.capabilityIds.join(", ")}`),
    ),
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

  const selector = resolveAddSelector(capabilityOrModule);
  const capabilities = new Set(selector.capabilityIds);
  const contracts = new Set(selector.contractIds);
  return modules.find((module) => {
    const moduleProviderKeys = new Set([
      module.id,
      module.providerKey,
      ...(module.providers ?? []).map((item) => item.id),
    ].filter((value): value is string => Boolean(value)).map(normalizeAddToken));
    const moduleCapabilities = new Set(module.capabilityIds ?? []);
    const moduleContracts = new Set(module.contracts ?? []);
    const capabilityMatch = [...capabilities].some((capability) => moduleCapabilities.has(capability));
    const contractMatch = [...contracts].some((contract) => moduleContracts.has(contract));

    return (
      (capabilityMatch || contractMatch)
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
    `Mount MCP servers for: ${(module.mcpServers ?? []).map((server) => server.id).join(", ") || "none"}.`,
    "Copy required env vars into .env.example and deployment secrets.",
    "Run npm run doctor.",
    "Run the module smoke checks before enabling sends.",
  ];
}

function resolveAddSelector(value: string): AddSelector {
  switch (normalizeAddToken(value)) {
    case "research":
      return {
        capabilityIds: ["search", "extract", "enrichment", "observability"],
        contractIds: [
          "research.search.v1",
          "research.extract.v1",
          "research.deepResearch.v1",
          "research.monitor.v1",
          "research.enrich.v1",
        ],
      };
    case "search":
      return {
        capabilityIds: ["search"],
        contractIds: ["research.search.v1"],
      };
    case "extract":
    case "extraction":
      return {
        capabilityIds: ["extract"],
        contractIds: ["research.extract.v1"],
      };
    case "deep-research":
    case "deepresearch":
      return {
        capabilityIds: [],
        contractIds: ["research.deepResearch.v1"],
      };
    case "enrich":
    case "enrichment":
      return {
        capabilityIds: ["enrichment"],
        contractIds: ["research.enrich.v1"],
      };
    case "monitor":
    case "monitoring":
      return {
        capabilityIds: [],
        contractIds: ["research.monitor.v1"],
      };
    case "convex":
    case "reactive":
    case "threads":
    case "memory":
      return {
        capabilityIds: ["state"],
        contractIds: [],
      };
    case "discovery":
    case "signal":
    case "signals":
      return {
        capabilityIds: ["source"],
        contractIds: [],
      };
    case "mail":
    case "outreach":
      return {
        capabilityIds: ["email"],
        contractIds: [],
      };
    default:
      return {
        capabilityIds: [normalizeAddToken(value) as AiSdrCapabilityId],
        contractIds: [],
      };
  }
}

function normalizeAddToken(value: string) {
  return value.trim().toLowerCase();
}
