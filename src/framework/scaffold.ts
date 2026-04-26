import {
  collectConfigEnv,
  defineAiSdr,
  providersFromModules,
  type AiSdrCapabilityBinding,
  type AiSdrConfig,
  type AiSdrEnvVar,
  type AiSdrModuleDefinition,
  type AiSdrPackageBoundary,
} from "./index.js";

export type AiSdrInitProfile = {
  id: string;
  displayName: string;
  description: string;
  compositionTargets: string[];
  moduleIds: string[];
};

export const aiSdrInitProfiles = {
  core: {
    id: "core",
    displayName: "Core runtime",
    description: "Smallest self-hostable Trellis runtime that can ingest normalized signals, research the web, run actors, persist state, and expose MCP tools.",
    compositionTargets: ["minimum"],
    moduleIds: [
      "normalized-webhook",
      "firecrawl",
      "convex",
      "rivet",
      "vercel-sandbox",
      "vercel-ai-gateway",
      "orchid-mcp",
    ],
  },
  starter: {
    id: "starter",
    displayName: "Starter AI SDR",
    description: "Core runtime plus discovery, deep research, and enrichment for a dry-run AI SDR deployment.",
    compositionTargets: ["minimum"],
    moduleIds: [
      "normalized-webhook",
      "apify-linkedin",
      "firecrawl",
      "parallel",
      "prospeo",
      "convex",
      "rivet",
      "vercel-sandbox",
      "vercel-ai-gateway",
      "orchid-mcp",
    ],
  },
  production: {
    id: "production",
    displayName: "Production parity AI SDR",
    description: "Current Orchid SDR stack with outbound email, CRM sync, handoff, discovery, and the full research lane.",
    compositionTargets: ["minimum", "productionParity"],
    moduleIds: [
      "normalized-webhook",
      "apify-linkedin",
      "firecrawl",
      "parallel",
      "prospeo",
      "attio",
      "agentmail",
      "slack-handoff",
      "convex",
      "rivet",
      "vercel-sandbox",
      "vercel-ai-gateway",
      "orchid-mcp",
    ],
  },
} as const satisfies Record<string, AiSdrInitProfile>;

export type AiSdrInitProfileId = keyof typeof aiSdrInitProfiles;

export type AiSdrScaffoldSpec = {
  profile: AiSdrInitProfile;
  config: AiSdrConfig;
  selectedModules: AiSdrModuleDefinition[];
  envVars: AiSdrEnvVar[];
};

export function resolveInitProfile(profile: string | undefined): AiSdrInitProfile {
  return aiSdrInitProfiles[(profile ?? "starter") as AiSdrInitProfileId] ?? aiSdrInitProfiles.starter;
}

export function buildScaffoldSpec(
  baseConfig: AiSdrConfig,
  input: {
    name: string;
    description?: string;
    profile?: string;
  },
): AiSdrScaffoldSpec {
  const profile = resolveInitProfile(input.profile);
  const selectedModuleIdSet = new Set(profile.moduleIds);
  const selectedModules = (baseConfig.modules ?? []).filter((module) => selectedModuleIdSet.has(module.id));
  const selectedProviderIdSet = new Set(providersFromModules(selectedModules).map((provider) => provider.id));

  const capabilityBindings = filterCapabilityBindings(
    baseConfig.capabilityBindings ?? [],
    selectedProviderIdSet,
  );
  const packageBoundaries = filterPackageBoundaries(
    baseConfig.packageBoundaries ?? [],
    selectedModuleIdSet,
    selectedProviderIdSet,
    selectedModules,
  );
  const campaigns = (baseConfig.campaigns ?? []).map((campaign) => ({
    ...campaign,
    sources: (campaign.sources ?? []).filter((source) => selectedProviderIdSet.has(source)),
  }));

  const config = defineAiSdr({
    ...baseConfig,
    name: input.name,
    description: input.description ?? baseConfig.description,
    compositionTargets: [...profile.compositionTargets],
    modules: selectedModules,
    providers: providersFromModules(selectedModules),
    capabilityBindings,
    packageBoundaries,
    campaigns,
  });

  return {
    profile,
    config,
    selectedModules,
    envVars: collectConfigEnv(config),
  };
}

export function renderScaffoldConfigModule(spec: AiSdrScaffoldSpec) {
  const selectedModuleIds = spec.selectedModules.map((module) => module.id);
  const configBody = {
    name: spec.config.name,
    description: spec.config.description,
    compositionTargets: spec.config.compositionTargets,
    knowledge: spec.config.knowledge,
    skills: spec.config.skills,
    modules: "modules",
    providers: "providersFromModules(modules)",
    capabilityBindings: spec.config.capabilityBindings,
    packageBoundaries: spec.config.packageBoundaries,
    campaigns: spec.config.campaigns,
    requiredEnv: spec.config.requiredEnv,
  };

  const serialized = JSON.stringify(configBody, null, 2)
    .replace('"modules": "modules"', '"modules": modules')
    .replace('"providers": "providersFromModules(modules)"', '"providers": providersFromModules(modules)');

  return [
    'import { defineAiSdr } from "./src/framework/index.js";',
    'import { defaultOrchidModules, providersFromModules } from "./src/framework/index.js";',
    "",
    `const selectedModuleIds = ${JSON.stringify(selectedModuleIds, null, 2)};`,
    "const modules = defaultOrchidModules().filter((module) => selectedModuleIds.includes(module.id));",
    "",
    `export default defineAiSdr(${serialized});`,
    "",
  ].join("\n");
}

export function renderScaffoldEnvExample(spec: AiSdrScaffoldSpec) {
  const defaults = new Map<string, string>([
    ["PORT", "3000"],
    ["APP_URL", "http://localhost:3000"],
    ["NODE_ENV", "development"],
    ["DASHBOARD_PASSWORD", ""],
    ["CONVEX_URL", "https://your-deployment.convex.cloud"],
    ["NEXT_PUBLIC_CONVEX_URL", "https://your-deployment.convex.cloud"],
    ["NO_SENDS_MODE", "true"],
    ["DEFAULT_CAMPAIGN_TIMEZONE", "UTC"],
    ["ORCHID_SDR_SANDBOX_TOKEN", "change-me"],
    ["ORCHID_SDR_MCP_TOKEN", ""],
    ["HANDOFF_WEBHOOK_SECRET", "change-me"],
  ]);

  for (const envVar of spec.envVars) {
    if (!defaults.has(envVar.name)) {
      defaults.set(envVar.name, "");
    }
  }

  return [...defaults.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("\n") + "\n";
}

export function renderScaffoldSetupChecklist(spec: AiSdrScaffoldSpec) {
  const requiredEnv = spec.envVars.filter((envVar) => envVar.required);
  const optionalEnv = spec.envVars.filter((envVar) => !envVar.required);
  const moduleLines = spec.selectedModules.map((module) =>
    `- \`${module.id}\` - ${module.description ?? module.displayName}`,
  );
  const requiredEnvLines = requiredEnv.map((envVar) =>
    `- \`${envVar.name}\`${envVar.description ? ` - ${envVar.description}` : ""}`,
  );
  const optionalEnvLines = optionalEnv.map((envVar) =>
    `- \`${envVar.name}\`${envVar.description ? ` - ${envVar.description}` : ""}`,
  );

  return `# Trellis Setup Checklist

This project was scaffolded with the **${spec.profile.displayName}** profile.

## What This Profile Includes

${moduleLines.join("\n")}

## First-Time Setup

1. Install dependencies

\`\`\`bash
npm install
\`\`\`

2. Copy envs

\`\`\`bash
cp .env.example .env
\`\`\`

3. Fill the required env values first

${requiredEnvLines.join("\n")}

4. Optionally fill the rest once you enable more providers

${optionalEnvLines.length > 0 ? optionalEnvLines.join("\n") : "- none"}

5. Verify locally

\`\`\`bash
npm run typecheck
npm test
npm run doctor
\`\`\`

6. Boot the app

\`\`\`bash
npm run dev
\`\`\`

7. Verify the operator surface

- Open \`http://localhost:3000/dashboard\`
- Check \`http://localhost:3000/healthz\`
- Confirm the dashboard resolves service, send mode, and automation flags

## Safe First Actions

- Keep \`NO_SENDS_MODE=true\`
- Use the dashboard or MCP to inspect runtime flags
- Post a normalized signal before enabling discovery or outbound
- Only enable optional providers after \`npm run doctor\` is clean

## Useful Commands

\`\`\`bash
npm run ai-sdr -- check
npm run doctor
npm run sandbox:probe
\`\`\`

## Common Failure Modes

- Missing \`CONVEX_URL\` or \`NEXT_PUBLIC_CONVEX_URL\`
- Missing \`ORCHID_SDR_SANDBOX_TOKEN\`
- Missing \`HANDOFF_WEBHOOK_SECRET\`
- Provider API keys present in config intent but absent in \`.env\`
- Running discovery or probe before the dashboard and health check are healthy
`;
}

function filterCapabilityBindings(
  capabilityBindings: AiSdrCapabilityBinding[],
  selectedProviderIds: Set<string>,
) {
  return capabilityBindings.filter((binding) => selectedProviderIds.has(binding.providerId));
}

function filterPackageBoundaries(
  packageBoundaries: AiSdrPackageBoundary[],
  selectedModuleIds: Set<string>,
  selectedProviderIds: Set<string>,
  selectedModules: AiSdrModuleDefinition[],
) {
  const selectedCapabilities = new Set(
    selectedModules.flatMap((module) => module.capabilityIds ?? []),
  );
  const selectedContracts = new Set(
    selectedModules.flatMap((module) => module.contracts ?? []),
  );

  return packageBoundaries
    .filter((boundary) =>
      boundary.id === "framework-core"
      || (boundary.moduleIds ?? []).some((moduleId) => selectedModuleIds.has(moduleId))
      || (boundary.providerIds ?? []).some((providerId) => selectedProviderIds.has(providerId)),
    )
    .map((boundary) =>
      boundary.id === "framework-core"
        ? {
          ...boundary,
          capabilityIds: (boundary.capabilityIds ?? []).filter((capabilityId) => selectedCapabilities.has(capabilityId)),
          contractIds: (boundary.contractIds ?? []).filter((contractId) => selectedContracts.has(contractId)),
        }
        : boundary,
    );
}
