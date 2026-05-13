import {
  aiSdrCompositionProfileIds,
  collectConfigEnv,
  collectWebhookDefinitions,
  defaultTrellisModules,
  defineAiSdr,
  providersFromModules,
  type AiSdrCapabilityBinding,
  type AiSdrConfig,
  type AiSdrEnvVar,
  type AiSdrModuleDefinition,
  type AiSdrPackageBoundary,
  type AiSdrWebhookDefinition,
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
    displayName: "Core Trellis app",
    description: "Smallest honest Trellis runtime that can ingest structured events, run actors, persist state, execute sandboxed turns, and expose MCP tools. Discovery, CRM, outbound email, enrichment, and handoff stay optional until you add them.",
    defaultDirectoryName: "trellis-core",
    compositionTargets: ["minimum"],
    moduleIds: [
      "normalized-webhook",
      "convex",
      "rivet",
      "vercel-sandbox",
      "vercel-ai-gateway",
      "trellis-mcp",
    ],
  },
} as const satisfies Record<string, AiSdrInitProfile>;

export type AiSdrInitProfileId = keyof typeof aiSdrInitProfiles;

const initProfileAliases = {
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
  configFileName: string;
  kitIds: string[];
  selection: {
    id: string;
    displayName: string;
    description: string;
    defaultDirectoryName: string;
  };
  config: AiSdrConfig;
  selectedModules: AiSdrModuleDefinition[];
  envVars: AiSdrEnvVar[];
};

export function resolveInitProfile(profile: string | undefined): AiSdrInitProfile {
  const normalizedProfile = profile && profile in initProfileAliases
    ? initProfileAliases[profile as keyof typeof initProfileAliases]
    : profile;
  if (!normalizedProfile || normalizedProfile === "core") {
    return aiSdrInitProfiles.core;
  }

  throw new Error(
    `Unknown init profile: ${normalizedProfile}. Trellis init now scaffolds the core app only. Add optional lanes with --with-discovery, --with-deep-research, --with-enrichment, --with-crm, --with-email, or --with-handoff.`,
  );
}

export function buildScaffoldSpec(
  baseConfig: AiSdrConfig,
  input: {
    name: string;
    description?: string;
    profile?: string;
    moduleIds?: string[];
    kitIds?: string[];
  },
): AiSdrScaffoldSpec {
  const profile = resolveInitProfile(input.profile);
  const selectedModuleIdSet = new Set(input.moduleIds ?? profile.moduleIds);
  const selectedModules = defaultTrellisModules().filter((module) => selectedModuleIdSet.has(module.id));
  const selectedProviderIdSet = new Set(providersFromModules(selectedModules).map((provider) => provider.id));
  const compositionTargets = resolveScaffoldCompositionTargets(profile, selectedModules);
  const selection = describeScaffoldSelection({
    profile,
    selectedModuleIds: [...selectedModuleIdSet],
  });

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
  const webhooks = filterWebhookDefinitions(
    collectWebhookDefinitions(baseConfig),
    selectedProviderIdSet,
  );

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
    webhooks,
  });

  return {
    profile,
    configFileName: `${input.name}.config.ts`,
    kitIds: input.kitIds ?? [],
    selection,
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

export function describeScaffoldSelection(input: {
  profile: AiSdrInitProfile;
  selectedModuleIds: string[];
}) {
  const exactMatch = findMatchingInitProfile(input.selectedModuleIds);
  if (exactMatch) {
    return {
      id: exactMatch.id,
      displayName: exactMatch.displayName,
      description: exactMatch.description,
      defaultDirectoryName: exactMatch.defaultDirectoryName,
    };
  }

  const coreModuleIds = new Set<string>(aiSdrInitProfiles.core.moduleIds);
  const optionalChoices = aiSdrInitModuleChoices.filter((choice) =>
    input.selectedModuleIds.includes(choice.moduleId) && !coreModuleIds.has(choice.moduleId),
  );

  return {
    id: "custom",
    displayName: "Custom Trellis stack",
    description: optionalChoices.length === 0
      ? input.profile.description
      : `Core runtime plus optional lanes: ${optionalChoices.map((choice) => choice.displayName).join(", ")}.`,
    defaultDirectoryName: optionalChoices.length === 0 ? input.profile.defaultDirectoryName : "trellis-custom",
  };
}

export function renderScaffoldConfigModule(spec: AiSdrScaffoldSpec) {
  const selectedModuleIds = spec.selectedModules.map((module) => module.id);
  const scaffoldName = spec.config.name;
  const scaffoldDescription = spec.config.description ?? `${spec.config.name} generated from the Trellis scaffold.`;
  const selectedProfileId = spec.profile.id;
  const selectedKitIds = spec.kitIds;
  const configBody = {
    name: "scaffoldName",
    description: "scaffoldDescription",
    compositionTargets: spec.config.compositionTargets,
    knowledge: spec.config.knowledge,
    skills: spec.config.skills,
    modules: "modules",
    providers: "providersFromModules(modules)",
    capabilityBindings: spec.config.capabilityBindings,
    mcp: spec.config.mcp,
    packageBoundaries: spec.config.packageBoundaries,
    campaigns: spec.config.campaigns,
    webhooks: spec.config.webhooks,
    requiredEnv: spec.config.requiredEnv,
  };

  const serialized = JSON.stringify(configBody, null, 2)
    .replace('"name": "scaffoldName"', '"name": scaffoldName')
    .replace('"description": "scaffoldDescription"', '"description": scaffoldDescription')
    .replace('"modules": "modules"', '"modules": modules')
    .replace('"providers": "providersFromModules(modules)"', '"providers": providersFromModules(modules)');

  return [
    'import { defineAiSdr, defaultTrellisModules, providersFromModules } from "@trellis/framework";',
    "",
    `const scaffoldName = ${JSON.stringify(scaffoldName)};`,
    `const scaffoldDescription = ${JSON.stringify(scaffoldDescription)};`,
    `const selectedProfileId = ${JSON.stringify(selectedProfileId)};`,
    `const selectedKitIds = ${JSON.stringify(selectedKitIds, null, 2)};`,
    `const selectedModuleIds = ${JSON.stringify(selectedModuleIds, null, 2)};`,
    "const modules = defaultTrellisModules().filter((module) => selectedModuleIds.includes(module.id));",
    "",
    `export default defineAiSdr(${serialized});`,
    "",
  ].join("\n");
}

export function renderScaffoldAppConfigModule(spec: AiSdrScaffoldSpec) {
  const configImportPath = `../${spec.configFileName.replace(/\.ts$/, ".js")}`;
  return [
    `import config from "${configImportPath}";`,
    "",
    "export default config;",
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
    ["TRELLIS_SANDBOX_TOKEN", "change-me"],
    ["TRELLIS_MCP_TOKEN", ""],
    ["SIGNAL_WEBHOOK_SECRET", "change-me"],
  ]);

  for (const envVar of spec.envVars) {
    if (!defaults.has(envVar.name)) {
      defaults.set(envVar.name, "");
    }
  }

  const demoCore = [
    "PORT",
    "APP_URL",
    "NODE_ENV",
    "DASHBOARD_PASSWORD",
    "TRELLIS_SANDBOX_TOKEN",
    "TRELLIS_MCP_TOKEN",
    "CONVEX_URL",
    "NEXT_PUBLIC_CONVEX_URL",
    "SIGNAL_WEBHOOK_SECRET",
  ].filter((name) => defaults.has(name));

  const required = spec.envVars
    .filter((envVar) => envVar.required && !demoCore.includes(envVar.name))
    .map((envVar) => envVar.name)
    .sort();

  const optional = spec.envVars
    .filter((envVar) => !envVar.required && !demoCore.includes(envVar.name))
    .map((envVar) => envVar.name)
    .sort();

  const sections = [
    "# Core app and safe demo defaults",
    ...demoCore.map((name) => `${name}=${defaults.get(name) ?? ""}`),
  ];

  if (required.length > 0) {
    sections.push("", "# Required for the selected lanes");
    for (const name of required) {
      sections.push(`${name}=${defaults.get(name) ?? ""}`);
    }
  }

  if (optional.length > 0) {
    sections.push("", "# Optional until you enable the matching provider or workflow");
    for (const name of optional) {
      sections.push(`${name}=${defaults.get(name) ?? ""}`);
    }
  }

  return `${sections.join("\n")}\n`;
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
  const webhookLines = (spec.config.webhooks ?? []).map((webhook) =>
    `- \`${webhook.method} ${webhook.path}\` - ${webhook.displayName}${webhook.secretEnv ? ` (secret: \`${webhook.secretEnv}\`)` : ""}`,
  );

  return `# Trellis Setup Checklist

This project was scaffolded as **${spec.selection.displayName}**${spec.kitIds.length > 0 ? ` with kit${spec.kitIds.length > 1 ? "s" : ""} **${spec.kitIds.join(", ")}**` : ""}.

${spec.selection.description}

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

This is a scaffold checklist. The happy path is Cloudflare-first and uses \`trellis init\`, \`docs add\`, \`doctor\`, \`smoke\`, \`deploy\`, and \`connect\`.

## Login And Auth Model

- Dashboard login:
  - route: \`/dashboard\`
  - password source: \`DASHBOARD_PASSWORD\`
  - fallback if unset: \`TRELLIS_SANDBOX_TOKEN\`
- Remote MCP auth:
  - route: \`/mcp/trellis\`
  - bearer token: \`TRELLIS_MCP_TOKEN\`
  - fallback if unset: \`TRELLIS_SANDBOX_TOKEN\`
- Claude Code quick setup:
  - \`npm run trellis -- mcp claude-code --local --write\`

## URL Derivation

- Local operator surface: \`http://localhost:3000/dashboard\`
- Local MCP endpoint: \`http://localhost:3000/mcp/trellis\`
- Deployed app origin: \`APP_URL\`
- If \`APP_URL\` is unset on Vercel, the app falls back to \`https://$VERCEL_URL\`
- Deployed MCP endpoint: \`\${APP_URL}/mcp/trellis\`
- Webhook endpoints: \`\${APP_URL}/webhooks/<provider>\`

## Configured Webhooks

${webhookLines.join("\n")}

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

- Use the dashboard or MCP to inspect runtime flags
- Post a structured webhook event before layering in optional providers
- Only enable optional providers after \`npm run doctor\` is clean

## Useful Commands

\`\`\`bash
npm run trellis -- check
npm run doctor
npm run trellis:sandbox:probe
\`\`\`

## Common Failure Modes

- Missing \`CONVEX_URL\` or \`NEXT_PUBLIC_CONVEX_URL\`
- Missing \`TRELLIS_SANDBOX_TOKEN\`
- Missing \`SIGNAL_WEBHOOK_SECRET\`
- Provider API keys present in config intent but absent in \`.env\`
- Running discovery or probe before the dashboard and health check are healthy
`;
}

function renderValueAccountLines(spec: AiSdrScaffoldSpec) {
  const selectedModuleIds = new Set(spec.selectedModules.map((module) => module.id));
  const lines = [
    "- `Convex` - live state, dashboard data, workflow persistence, and the default system of record.",
    "- `Vercel` - sandbox execution and AI Gateway model routing in the default happy path.",
    "- `Rivet` - actor orchestration, scheduling, and runtime control plane.",
  ];

  if (selectedModuleIds.has("firecrawl")) {
    lines.push("- `Firecrawl` - web search and extraction.");
  }

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

function filterWebhookDefinitions(
  webhooks: AiSdrWebhookDefinition[],
  selectedProviderIds: Set<string>,
) {
  return webhooks.filter((webhook) => !webhook.providerId || selectedProviderIds.has(webhook.providerId));
}

function resolveScaffoldCompositionTargets(profile: AiSdrInitProfile, selectedModules: AiSdrModuleDefinition[]) {
  const supportedTargets = aiSdrCompositionProfileIds.filter((target) =>
    evaluateModuleComposition(selectedModules, { profile: target as AiSdrCompositionProfileId }).ok,
  );

  return supportedTargets.length > 0 ? supportedTargets : [profile.compositionTargets[0] ?? "minimum"];
}

function findMatchingInitProfile(selectedModuleIds: string[]) {
  const normalizedSelection = [...new Set(selectedModuleIds)].sort();

  return Object.values(aiSdrInitProfiles).find((profile) => {
    const normalizedProfileModules = [...profile.moduleIds].sort();
    return normalizedProfileModules.length === normalizedSelection.length
      && normalizedProfileModules.every((moduleId, index) => moduleId === normalizedSelection[index]);
  }) ?? null;
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
