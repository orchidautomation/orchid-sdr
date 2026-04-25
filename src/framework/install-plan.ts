import type { AiSdrModuleDefinition } from "./index.js";

export type AiSdrModuleInstallPlan = {
  moduleId: string;
  displayName: string;
  packageName: string | null;
  alreadyInstalled: boolean;
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
