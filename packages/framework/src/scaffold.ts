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
import { evaluateModuleComposition, type AiSdrCompositionProfileId } from "./composition.js";

export type AiSdrInitProfile = {
  id: string;
  displayName: string;
  description: string;
  defaultDirectoryName: string;
  compositionTargets: string[];
  moduleIds: string[];
};

export type AiSdrInitModuleChoice = {
  id: string;
  displayName: string;
  description: string;
  moduleId: string;
};

export const aiSdrInitProfiles = {
  core: {
    id: "core",
    displayName: "Core runtime",
    description: "Smallest honest Trellis runtime that can ingest normalized signals, research the web, run actors, persist state, and expose MCP tools. No live discovery, CRM sync, or outbound providers by default.",
    defaultDirectoryName: "trellis-core",
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
    defaultDirectoryName: "trellis-starter",
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
    defaultDirectoryName: "trellis-production",
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

const legacyInitProfileAliases = {
  demo: "core",
} as const satisfies Record<string, AiSdrInitProfileId>;

export const aiSdrInitModuleChoices = [
  {
    id: "discovery",
    displayName: "Live Discovery",
    description: "Apify LinkedIn public-post discovery for finding new signals on a schedule.",
    moduleId: "apify-linkedin",
  },
  {
    id: "deep-research",
    displayName: "Deep Research",
    description: "Parallel deep research and monitoring for broader async research workflows.",
    moduleId: "parallel",
  },
  {
    id: "enrichment",
    displayName: "Enrichment",
    description: "Prospeo contact enrichment for email discovery and higher-confidence prospect data.",
    moduleId: "prospeo",
  },
  {
    id: "crm",
    displayName: "CRM Sync",
    description: "Attio writeback for prospects, accounts, and stage updates.",
    moduleId: "attio",
  },
  {
    id: "email",
    displayName: "Outbound Email",
    description: "AgentMail outbound sending, inboxes, and reply handling.",
    moduleId: "agentmail",
  },
  {
    id: "handoff",
    displayName: "Slack Handoff",
    description: "Slack notifications and human escalation routing.",
    moduleId: "slack-handoff",
  },
] as const satisfies readonly AiSdrInitModuleChoice[];

export type AiSdrScaffoldSpec = {
  profile: AiSdrInitProfile;
  config: AiSdrConfig;
  selectedModules: AiSdrModuleDefinition[];
  envVars: AiSdrEnvVar[];
};

export function resolveInitProfile(profile: string | undefined): AiSdrInitProfile {
  const normalizedProfile = profile && profile in legacyInitProfileAliases
    ? legacyInitProfileAliases[profile as keyof typeof legacyInitProfileAliases]
    : profile;
  return aiSdrInitProfiles[(normalizedProfile ?? "starter") as AiSdrInitProfileId] ?? aiSdrInitProfiles.starter;
}

export function buildScaffoldSpec(
  baseConfig: AiSdrConfig,
  input: {
    name: string;
    description?: string;
    profile?: string;
    moduleIds?: string[];
  },
): AiSdrScaffoldSpec {
  const profile = resolveInitProfile(input.profile);
  const selectedModuleIdSet = new Set(input.moduleIds ?? profile.moduleIds);
  const selectedModules = (baseConfig.modules ?? []).filter((module) => selectedModuleIdSet.has(module.id));
  const selectedProviderIdSet = new Set(providersFromModules(selectedModules).map((provider) => provider.id));
  const compositionTargets = resolveScaffoldCompositionTargets(profile, selectedModules);

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
    compositionTargets,
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

export function resolveInitModuleIds(
  profileId: string | undefined,
  input: {
    include?: string[];
    exclude?: string[];
  } = {},
) {
  const profile = resolveInitProfile(profileId);
  const selectedModuleIds = new Set(profile.moduleIds);
  const include = new Set(input.include ?? []);
  const exclude = new Set(input.exclude ?? []);

  for (const choice of aiSdrInitModuleChoices) {
    if (include.has(choice.id) || include.has(choice.moduleId)) {
      selectedModuleIds.add(choice.moduleId);
    }
    if (exclude.has(choice.id) || exclude.has(choice.moduleId)) {
      selectedModuleIds.delete(choice.moduleId);
    }
  }

  return [...selectedModuleIds];
}

export function isInitModuleEnabled(profile: AiSdrInitProfile, choice: AiSdrInitModuleChoice) {
  return profile.moduleIds.includes(choice.moduleId);
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
    'import { defineAiSdr, defaultOrchidModules, providersFromModules } from "@ai-sdr/framework";',
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

${spec.profile.description}

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

## External Accounts You Actually Need

You can boot the app with the required env block above, but to actually feel the selected profile you usually want these vendors connected:

${renderValueAccountLines(spec)}

Vercel OAuth is **not** part of the default Trellis auth story right now. The current happy path uses tokens and provider keys so the scaffold stays self-hostable and works outside a Vercel-only environment.

## Login And Auth Model

- Dashboard login:
  - route: \`/dashboard\`
  - password source: \`DASHBOARD_PASSWORD\`
  - fallback if unset: \`ORCHID_SDR_SANDBOX_TOKEN\`
- Remote MCP auth:
  - route: \`/mcp/orchid-sdr\`
  - bearer token: \`ORCHID_SDR_MCP_TOKEN\`
  - fallback if unset: \`ORCHID_SDR_SANDBOX_TOKEN\`

## URL Derivation

- Local operator surface: \`http://localhost:3000/dashboard\`
- Local MCP endpoint: \`http://localhost:3000/mcp/orchid-sdr\`
- Deployed app origin: \`APP_URL\`
- If \`APP_URL\` is unset on Vercel, the app falls back to \`https://$VERCEL_URL\`
- Deployed MCP endpoint: \`\${APP_URL}/mcp/orchid-sdr\`
- Webhook endpoints: \`\${APP_URL}/webhooks/<provider>\`

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

function renderValueAccountLines(spec: AiSdrScaffoldSpec) {
  const selectedModuleIds = new Set(spec.selectedModules.map((module) => module.id));
  const lines = [
    "- `Convex` - live state, dashboard data, workflow persistence, and the default system of record.",
    "- `Vercel` - sandbox execution and AI Gateway model routing in the default happy path.",
    "- `Firecrawl` - the default web search and extraction provider.",
    "- `Rivet` - actor orchestration, scheduling, and runtime control plane.",
  ];

  if (selectedModuleIds.has("apify-linkedin")) {
    lines.push("- `Apify` - scheduled LinkedIn public-post discovery.");
  }
  if (selectedModuleIds.has("parallel")) {
    lines.push("- `Parallel` - deep research and monitoring workflows.");
  }
  if (selectedModuleIds.has("prospeo")) {
    lines.push("- `Prospeo` - contact enrichment and email discovery.");
  }
  if (selectedModuleIds.has("attio")) {
    lines.push("- `Attio` - CRM writeback and stage sync.");
  }
  if (selectedModuleIds.has("agentmail")) {
    lines.push("- `AgentMail` - outbound sending, inboxes, and reply handling.");
  }
  if (selectedModuleIds.has("slack-handoff")) {
    lines.push("- `Slack` - handoff and human escalation routing.");
  }

  return lines.join("\n");
}

function filterCapabilityBindings(
  capabilityBindings: AiSdrCapabilityBinding[],
  selectedProviderIds: Set<string>,
) {
  return capabilityBindings.filter((binding) => selectedProviderIds.has(binding.providerId));
}

function resolveScaffoldCompositionTargets(profile: AiSdrInitProfile, selectedModules: AiSdrModuleDefinition[]) {
  const supportedTargets = profile.compositionTargets.filter((target) =>
    evaluateModuleComposition(selectedModules, { profile: target as AiSdrCompositionProfileId }).ok,
  );

  return supportedTargets.length > 0 ? supportedTargets : ["minimum"];
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
