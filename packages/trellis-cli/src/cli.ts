import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

import { ConvexHttpClient } from "convex/browser";
import { createClient } from "rivetkit/client";
import { loadProcessEnvFiles } from "../../framework/src/env-loader.js";
import { convexMutations, convexQueries } from "../../default-sdr/src/convex-repository.js";

import {
  aiSdrCompositionProfileIds,
  buildModuleInstallPlan,
  defaultTrellisModules,
  evaluateModuleComposition,
  findModuleForAddCommand,
  type AiSdrCompositionProfileId,
  type AiSdrConfig,
  type AiSdrModuleDefinition,
} from "../../framework/src/index.js";
import {
  aiSdrInitModuleChoices,
  buildScaffoldSpec,
  describeScaffoldSelection,
  renderScaffoldAppConfigModule,
  renderScaffoldConfigModule,
  renderScaffoldEnvExample,
  renderScaffoldSetupChecklist,
  resolveInitProfile,
  resolveInitModuleIds,
} from "../../framework/src/scaffold.js";
import { runTrellisSmoke } from "../../gtm/src/index.js";
import { buildClaudeCodeMcpConfig, mergeClaudeCodeMcpConfig } from "./mcp-config.js";

loadProcessEnvFiles();

const [command, ...commandArgs] = process.argv.slice(2);
const parsedCliArgs = parseCliArgs(commandArgs);
const arg = parsedCliArgs.positionals[0];
const providerArg = parsedCliArgs.positionals[1];
const cliFlags = parsedCliArgs.flags;
const jsonOutput = isJsonOutput(cliFlags);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const referenceAppRoot = path.resolve(repoRoot, "examples/reference-app");
const coreAppRoot = path.resolve(repoRoot, "examples/core-app");
const meetingPrepRoot = path.resolve(repoRoot, "examples/meeting-prep");
const trellisStateDirName = ".trellis";
const knowledgePackManifestName = "knowledge-pack.json";
const SHARED_SCAFFOLD_COPY_ENTRIES = [
  ".dockerignore",
  ".gitignore",
  "Dockerfile",
  "docker-compose.example.yml",
  "docs",
  "packages",
  "tsconfig.json",
  "vercel.json",
];
const CORE_SCAFFOLD_COPY_ENTRIES = [
  "convex",
  "knowledge",
  "scripts",
  "skills",
  "src",
  "tests",
];

const DOMAIN_KITS = {
  sdr: {
    id: "sdr",
    displayName: "AI SDR",
    root: referenceAppRoot,
    copyEntries: ["convex", "knowledge", "scripts", "skills", "src", "tests"],
  },
  "meeting-prep": {
    id: "meeting-prep",
    displayName: "Meeting prep",
    root: meetingPrepRoot,
    copyEntries: ["convex", "knowledge", "skills", "src", "tests"],
  },
} as const;

type DomainKitId = keyof typeof DOMAIN_KITS;

const V3_CONNECTIONS = {
  attio: {
    id: "attio",
    kind: "crm",
    displayName: "Attio",
    requiredEnv: ["ATTIO_API_KEY"],
    optionalEnv: ["ATTIO_DEFAULT_LIST_ID"],
    capabilities: ["crm.syncProspect", "crm.stagePromotion"],
  },
  agentmail: {
    id: "agentmail",
    kind: "email",
    displayName: "AgentMail",
    requiredEnv: ["AGENTMAIL_API_KEY"],
    optionalEnv: ["AGENTMAIL_WEBHOOK_SECRET"],
    capabilities: ["mail.preview", "mail.send", "mail.reply", "reply.webhook"],
  },
  firecrawl: {
    id: "firecrawl",
    kind: "research",
    displayName: "Firecrawl",
    requiredEnv: ["FIRECRAWL_API_KEY"],
    optionalEnv: [],
    capabilities: ["research.search", "research.extract", "browser.run"],
  },
  langfuse: {
    id: "langfuse",
    kind: "observability",
    displayName: "Langfuse",
    requiredEnv: ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY", "LANGFUSE_BASE_URL"],
    optionalEnv: [],
    capabilities: ["trace.export", "evals.export"],
  },
} as const;

type V3ConnectionId = keyof typeof V3_CONNECTIONS;
const REQUIRED_V3_PROVIDER_IDS = ["attio", "agentmail", "firecrawl"] as const;
const OPTIONAL_V3_PROVIDER_IDS = ["langfuse"] as const;
let activeConfigPromise: Promise<AiSdrConfig> | undefined;

type CloudflareResourceConfig = {
  configPath: string | null;
  format: "json" | "toml" | "missing";
  d1Databases: Array<{
    binding: string | null;
    databaseName: string | null;
    databaseId: string | null;
  }>;
  r2Buckets: Array<{
    binding: string | null;
    bucketName: string | null;
  }>;
  queueProducers: Array<{
    binding: string | null;
    queue: string | null;
  }>;
  queueConsumers: Array<{
    queue: string | null;
    deadLetterQueue: string | null;
  }>;
  workflows: Array<{
    binding: string | null;
    name: string | null;
    className: string | null;
  }>;
};

type CloudflareProvisioningPlan = {
  config: CloudflareResourceConfig;
  d1: {
    binding: "TRELLIS_DB";
    databaseName: string | null;
    databaseId: string | null;
    ready: boolean;
    autoResolvable: boolean;
    commands: string[];
  };
  r2Buckets: Array<{
    binding: "TRELLIS_PACKS" | "TRELLIS_ARTIFACTS";
    bucketName: string | null;
    ready: boolean;
    commands: string[];
  }>;
  queue: {
    binding: "TRELLIS_EVENTS";
    queueName: string | null;
    deadLetterQueueName: string | null;
    ready: boolean;
    commands: string[];
  };
  summary: {
    configPath: string | null;
    readyForDeploy: boolean;
    autoProvisionable: boolean;
    resources: Array<{
      id: string;
      ready: boolean;
      detail: string;
      commands: string[];
    }>;
  };
};

await main();

async function main() {
  try {
    switch (command) {
      case undefined:
      case "help":
        printHelp();
        break;
      case "modules":
        requireLegacyCommand("modules", "Use `trellis connect <provider>` and `trellis docs add <path>` in v3.");
        await listModules();
        break;
      case "add":
        await printAddPlan(arg);
        break;
      case "check":
        requireLegacyCommand("check", "Use `trellis doctor` for the v3 reliability check.");
        await printCompositionCheck();
        break;
      case "connect":
        await handleConnectCommand(arg);
        break;
      case "docs":
        await handleDocsCommand(arg, providerArg);
        break;
      case "doctor":
        await handleDoctorCommand();
        break;
      case "smoke":
        await handleSmokeCommand(arg);
        break;
      case "deploy":
        await handleDeployCommand(arg, cliFlags);
        break;
      case "admin":
        requireLegacyCommand("admin", "The v3 operator surface is the generated dashboard and MCP routes.");
        await handleAdminCommand(arg, cliFlags);
        break;
      case "discovery":
        requireLegacyCommand("discovery", "The v3 path ingests signals through Cloudflare webhooks and queues.");
        await handleDiscoveryCommand(arg, providerArg, cliFlags);
        break;
      case "mcp":
        await handleMcpCommand(arg, cliFlags);
        break;
      case "init":
        if (cliFlags.legacy === true || typeof cliFlags.kit === "string") {
          await scaffoldProject(arg, cliFlags);
        } else {
          await scaffoldV3Project(arg, cliFlags);
        }
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exitCode = 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonOutput) {
      console.error(JSON.stringify({
        ok: false,
        command: command ?? "help",
        error: message,
      }, null, 2));
    } else {
      console.error(message);
    }
    process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`trellis workspace commands:

  npm run trellis -- connect <business-provider>
  npm run trellis -- docs add <path>
  npm run trellis -- doctor
  npm run trellis -- smoke
  npm run trellis -- deploy
  npm run trellis -- init <target-dir> [--name my-app]
  npm run trellis -- <command> --json

Examples:

  npm run trellis -- init ../acme-sdr --name acme-sdr
  npm run trellis -- connect attio
  npm run trellis -- connect agentmail
  npm run trellis -- connect firecrawl
  npm run trellis -- docs add ./product-docs
  npm run trellis -- doctor
  npm run trellis -- smoke
  npm run trellis -- deploy
  npm run trellis -- deploy --json

Simple labels stay short in the CLI: attio, agentmail, firecrawl, langfuse.

Init scaffolds the Trellis v3 GTM path by default.
Cloudflare is the default deploy target.
Business providers are connected after first boot.
Use --json when a plugin or coding agent is orchestrating the setup.
Legacy composition commands still exist behind explicit --legacy for migration work, but they are not part of the v3 happy path.`);
}

function requireLegacyCommand(commandName: string, replacement: string) {
  if (cliFlags.legacy === true) {
    return;
  }
  throw new Error(`trellis ${commandName} is legacy composition tooling. ${replacement} Re-run with --legacy only while maintaining the old reference app.`);
}

async function handleAdminCommand(subcommand: string | undefined, flags: Record<string, string | boolean>) {
  switch (subcommand) {
    case "cleanup-stale":
    case "cleanup":
      await handleCleanupStaleAdminCommand(flags);
      return;
    default:
      throw new Error("Unknown admin command. Use: npm run trellis -- admin cleanup-stale [--apply]");
  }
}

async function handleCleanupStaleAdminCommand(flags: Record<string, string | boolean>) {
  const convexUrl = requireEnv("CONVEX_URL");
  const client = new ConvexHttpClient(convexUrl);
  const limit = Number(flags["limit"] ?? "50");
  const staleMinutes = Number(flags["stale-minutes"] ?? "90");
  const apply = Boolean(flags.apply);
  const pauseReason = typeof flags["pause-reason"] === "string"
    ? flags["pause-reason"]
    : "stale capture_signal cleanup";

  const audit = await client.query(convexQueries.auditDataQuality, {
    limit,
    staleMinutes,
  });

  if (jsonOutput) {
    if (!apply) {
      emitJson({
        ok: true,
        command: "admin",
        subcommand: "cleanup-stale",
        applied: false,
        audit,
      });
      return;
    }

    const cleanup = await client.mutation(convexMutations.cleanupDataQuality, {
      limit,
      staleMinutes,
      pauseReason,
      dryRun: false,
    });
    emitJson({
      ok: true,
      command: "admin",
      subcommand: "cleanup-stale",
      applied: true,
      audit,
      cleanup,
    });
    return;
  }

  console.log("Stale-state cleanup audit:");
  console.log(JSON.stringify(audit, null, 2));
  if (!apply) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to patch noisy titles and pause stale capture_signal rows.");
    return;
  }

  const cleanup = await client.mutation(convexMutations.cleanupDataQuality, {
    limit,
    staleMinutes,
    pauseReason,
    dryRun: false,
  });
  console.log("");
  console.log("Applied cleanup:");
  console.log(JSON.stringify(cleanup, null, 2));
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function handleDiscoveryCommand(
  subcommand: string | undefined,
  value: string | undefined,
  flags: Record<string, string | boolean>,
) {
  const endpoint = String(flags.endpoint ?? process.env.RIVET_CLIENT_ENDPOINT ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}/api/rivet`);
  const source = String(flags.source ?? "linkedin_public_post") as "linkedin_public_post" | "x_public_post";
  const campaignId = String(flags.campaign ?? "cmp_default");

  const registry = await loadDiscoveryRegistry();
  const client = createClient<typeof registry>({
    endpoint,
    disableMetadataLookup: true,
  });
  const discoveryActor = (client as any).discoveryCoordinator;
  if (!discoveryActor) {
    throw new Error("Discovery commands require the SDR kit or reference app runtime. This scaffold does not expose discovery actors.");
  }
  const actor = discoveryActor.getOrCreate([campaignId, source]) as any;

  switch (subcommand) {
    case "seed": {
      const term = value ?? (typeof flags.term === "string" ? flags.term : undefined);
      if (!term) {
        throw new Error("Missing discovery term. Example: npm run trellis -- discovery seed \"clay workflow\"");
      }

      const result = await actor.addSeedTerms({
        source,
        terms: [term],
      });
      const snapshot = await actor.getSnapshot() as any;
      console.log(JSON.stringify({ endpoint, result, latestTerm: snapshot.terms[0] ?? null }, null, 2));
      return;
    }
    case "run": {
      const term = value ?? (typeof flags.term === "string" ? flags.term : undefined);
      if (!term) {
        throw new Error("Missing discovery term. Example: npm run trellis -- discovery run \"https://www.linkedin.com/feed/update/urn:li:activity:123/\"");
      }

      const reason = String(flags.reason ?? "manual_cli");
      const result = await actor.runTerm({
        source,
        campaignId,
        term,
        reason,
      });
      const snapshot = await actor.getSnapshot() as any;
      console.log(JSON.stringify({ endpoint, result, latestRun: snapshot.runs[0] ?? null, state: snapshot.state }, null, 2));
      return;
    }
    case "tick": {
      const reason = String(flags.reason ?? "manual_cli");
      const result = await actor.enqueueTick({ reason });
      const snapshot = await actor.getSnapshot() as any;
      console.log(JSON.stringify({ endpoint, result, latestRun: snapshot.runs[0] ?? null, state: snapshot.state }, null, 2));
      return;
    }
    default:
      throw new Error(
        "Unknown discovery command. Use one of: seed, run, tick",
      );
  }
}

async function listModules() {
  const config = await getActiveConfig();
  const installed = new Set((config.modules ?? []).map((module: AiSdrModuleDefinition) => module.id));
  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "modules",
      modules: defaultTrellisModules().map((module: AiSdrModuleDefinition) => ({
        id: module.id,
        displayName: module.displayName,
        packageName: module.packageName ?? null,
        providerKey: module.providerKey ?? null,
        capabilityIds: module.capabilityIds ?? [],
        contracts: module.contracts ?? [],
        installed: installed.has(module.id),
      })),
    });
    return;
  }
  for (const module of defaultTrellisModules()) {
    const status = installed.has(module.id) ? "installed" : "available";
    const pkg = module.packageName ? ` ${module.packageName}` : "";
    console.log(`${module.id}\t${status}\t${module.displayName}${pkg}`);
  }
}

async function printCompositionCheck() {
  const config = await getActiveConfig();
  const evaluations = resolveConfiguredCompositionProfiles(config).map((profile: AiSdrCompositionProfileId) =>
    evaluateModuleComposition(config.modules ?? [], { profile }),
  );
  if (jsonOutput) {
    emitJson({
      ok: evaluations.every((evaluation) => evaluation.ok),
      command: "check",
      profiles: evaluations.map((evaluation: ReturnType<typeof evaluateModuleComposition>) => ({
        profileId: evaluation.profile.id,
        displayName: evaluation.profile.displayName,
        ok: evaluation.ok,
        missingCapabilities: evaluation.missingCapabilities,
        missingContracts: evaluation.missingContracts,
        providedCapabilities: evaluation.providedCapabilities,
        providedContracts: evaluation.providedContracts,
      })),
    });
    return;
  }
  for (const evaluation of evaluations) {
    console.log(`${evaluation.ok ? "ok" : "error"}: ${evaluation.profile.displayName}`);
    printList("  Missing capabilities", evaluation.missingCapabilities);
    printList("  Missing contracts", evaluation.missingContracts);
  }
}

function resolveConfiguredCompositionProfiles(config: AiSdrConfig) {
  const supportedProfiles = new Set(aiSdrCompositionProfileIds);
  const configured = (config.compositionTargets ?? []).filter((profile: string): profile is AiSdrCompositionProfileId =>
    supportedProfiles.has(profile as AiSdrCompositionProfileId),
  );
  return configured.length > 0 ? configured : (["minimum", "productionParity"] as const);
}

async function importConfigFrom(filePath: string): Promise<AiSdrConfig> {
  const module = await import(pathToFileURL(filePath).href);
  return module.default as AiSdrConfig;
}

async function loadActiveConfig(): Promise<AiSdrConfig> {
  const localConfigPath = tryResolveScaffoldConfigPath(process.cwd());
  if (localConfigPath) {
    return await importConfigFrom(localConfigPath);
  }

  const fallbackPath = path.join(repoRoot, "examples/reference-app/trellis.config.ts");
  return await importConfigFrom(fallbackPath);
}

async function getActiveConfig(): Promise<AiSdrConfig> {
  activeConfigPromise ??= loadActiveConfig();
  return activeConfigPromise;
}

async function loadBundledBaseConfig(kitIds: DomainKitId[]): Promise<AiSdrConfig> {
  const root = kitIds[0] ? DOMAIN_KITS[kitIds[0]].root : coreAppRoot;
  return await importConfigFrom(path.join(root, "trellis.config.ts"));
}

async function loadDiscoveryRegistry() {
  const localRegistryPath = path.join(process.cwd(), "src/registry.ts");
  const registryPath = pathExistsSync(localRegistryPath)
    ? localRegistryPath
    : path.join(repoRoot, "examples/reference-app/src/registry.ts");
  const module = await import(pathToFileURL(registryPath).href);
  return module.registry;
}

async function printAddPlan(moduleId: string | undefined) {
  if (!moduleId) {
    console.error("Missing module or capability. In v3, use connect <provider> or docs add <path>. Legacy add requires --legacy.");
    process.exitCode = 1;
    return;
  }

  if (cliFlags.legacy !== true) {
    throw new Error(
      "trellis add is a legacy composition command. Use trellis connect <provider> for v3, or re-run add with --legacy while maintaining the old reference app.",
    );
  }

  if (moduleId === "kit") {
    const kitId = providerArg;
    if (!kitId || !(kitId in DOMAIN_KITS)) {
      console.error(`Unknown or missing kit. Available kits: ${Object.keys(DOMAIN_KITS).join(", ")}`);
      process.exitCode = 1;
      return;
    }

    if (cliFlags.apply === true || cliFlags.write === true) {
      await applyKitToScaffold(kitId as DomainKitId);
      return;
    }

    console.log(`Kit: ${kitId}`);
    console.log(`Run: npm run trellis -- add kit ${kitId} --apply`);
    return;
  }

  if (moduleId === "langfuse") {
    await printLangfuseConnectionGuide();
    return;
  }

  const module = findModuleForAddCommand(defaultTrellisModules(), {
    capabilityOrModule: moduleId,
    provider: providerArg,
  });
  if (!module) {
    const requested = providerArg ? `${moduleId} ${providerArg}` : moduleId;
    console.error(`Unknown module or provider capability: ${requested}`);
    process.exitCode = 1;
    return;
  }

  if (cliFlags.apply === true || cliFlags.write === true) {
    await applyModuleToScaffold(module);
    return;
  }

  await printPlan(module);
}

async function handleConnectCommand(moduleId: string | undefined) {
  if (!moduleId) {
    const guides = Object.keys(V3_CONNECTIONS).map((id) => `npm run trellis -- connect ${id}`);
    if (jsonOutput) {
      emitJson({
        ok: true,
        command: "connect",
        mode: "help",
        guides,
        notes: ["Provider credentials can be connected after the first Cloudflare deploy."],
      });
      return;
    }
    console.log(`Connection guides:

  npm run trellis -- connect attio
  npm run trellis -- connect agentmail
  npm run trellis -- connect firecrawl
  npm run trellis -- connect langfuse

Provider credentials can be connected after the first Cloudflare deploy.`);
    return;
  }

  const v3Connection = resolveV3Connection(moduleId, providerArg);
  if (v3Connection) {
    await printV3ConnectionGuide(v3Connection);
    return;
  }

  if (cliFlags.legacy !== true) {
    throw new Error(
      `Non-v3 provider/module setup is legacy. Use one of: ${Object.keys(V3_CONNECTIONS).join(", ")}. Re-run with --legacy only if you are maintaining the old reference app.`,
    );
  }

  const module = findModuleForAddCommand(defaultTrellisModules(), {
    capabilityOrModule: moduleId,
    provider: providerArg,
  });
  if (!module) {
    const requested = providerArg ? `${moduleId} ${providerArg}` : moduleId;
    throw new Error(`Unknown module or provider capability: ${requested}`);
  }

  const applyResult = cliFlags.apply === true || cliFlags.write === true
    ? await applyModuleToScaffold(module)
    : null;
  if (applyResult) {
    if (!jsonOutput) {
      console.log("");
    }
  }

  if (jsonOutput) {
    const config = await getActiveConfig();
    const plan = buildModuleInstallPlan(module, {
      installedModuleIds: (config.modules ?? []).map((item: AiSdrModuleDefinition) => item.id),
    });
    emitJson({
      ok: true,
      command: "connect",
      apply: applyResult,
      module: summarizeInstallPlan(plan),
    });
    return;
  }

  await printConnectionGuide(module);
}

function resolveV3Connection(moduleId: string, provider: string | undefined) {
  const candidate = (provider ?? moduleId).toLowerCase();
  return candidate in V3_CONNECTIONS
    ? V3_CONNECTIONS[candidate as V3ConnectionId]
    : null;
}

async function printV3ConnectionGuide(guide: (typeof V3_CONNECTIONS)[V3ConnectionId]) {
  const manifest = await writeV3ConnectionManifest(guide);
  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "connect",
      mode: "v3-provider",
      provider: guide,
      manifest,
      defaults: {
        firstDeployRequiresProviderCredentials: false,
        noSendsModeUntilApproved: true,
      },
      next: [
        `set ${guide.requiredEnv.join(", ")}`,
        "run trellis smoke",
        "turn off no-send mode only after approvals are configured",
      ],
    });
    return;
  }
  console.log(`${guide.displayName} connection guide:

Required env:
${guide.requiredEnv.map((name) => `  - ${name}`).join("\n")}

Optional env:
${guide.optionalEnv.length > 0 ? guide.optionalEnv.map((name) => `  - ${name}`).join("\n") : "  none"}

Manifest:
  - ${manifest.path}
  - status: ${manifest.status}

v3 behavior:
  - credentials are connected after the Cloudflare app boots
  - smoke mode still runs without this provider
  - outbound writes stay gated by Trellis safety until approval checks pass`);
}

async function printLangfuseConnectionGuide() {
  await printV3ConnectionGuide(V3_CONNECTIONS.langfuse);
}

async function handleDocsCommand(subcommand: string | undefined, docsPath: string | undefined) {
  if (subcommand !== "add") {
    throw new Error("Unknown docs command. Use: npm run trellis -- docs add <path>");
  }
  if (!docsPath) {
    throw new Error("Missing docs path. Use: npm run trellis -- docs add ./product-docs");
  }

  const resolvedPath = path.resolve(process.cwd(), docsPath);
  const files = await collectMarkdownFiles(resolvedPath);
  if (files.length === 0) {
    throw new Error(`No markdown files found at ${resolvedPath}`);
  }

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: toPosixPath(path.relative(process.cwd(), resolvedPath)) || ".",
    target: "r2://TRELLIS_PACKS/knowledge",
    files: await Promise.all(files.map(async (filePath) => {
      const contents = await readFile(filePath);
      return {
        path: toPosixPath(path.relative(process.cwd(), filePath)),
        bytes: contents.byteLength,
        sha256: createHash("sha256").update(contents).digest("hex"),
      };
    })),
  };
  const trellisDir = path.join(process.cwd(), trellisStateDirName);
  const manifestPath = path.join(trellisDir, knowledgePackManifestName);
  await mkdir(trellisDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "docs",
      subcommand: "add",
      path: docsPath,
      resolvedPath,
      manifestPath,
      target: "R2-backed Trellis knowledge pack",
      files: manifest.files,
      next: [
        "trellis deploy uses this manifest as the TRELLIS_PACKS upload plan",
        "run trellis smoke to verify pack loading",
      ],
    });
    return;
  }

  console.log(`Docs add plan:

  source: ${resolvedPath}
  manifest: ${manifestPath}
  files: ${manifest.files.length}
  target: Trellis knowledge pack

v3 behavior:
  - record markdown file hashes in .trellis/knowledge-pack.json
  - deploy uses the manifest as the R2-backed pack upload plan
  - make them available to skills through the Trellis sandbox filesystem
  - verify retrieval during trellis smoke`);
}

async function handleDoctorCommand() {
  const wranglerConfigPath = findWranglerConfig(process.cwd());
  const wranglerSource = wranglerConfigPath ? readFileSync(wranglerConfigPath, "utf8") : "";
  const cloudflareResources = readCloudflareResourceConfig(wranglerConfigPath);
  const provisioning = buildCloudflareProvisioningPlan(cloudflareResources);
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
  const skillPack = await loadSkillPack(process.cwd());
  const providerReadiness = await loadAllV3ProviderReadiness();
  const smoke = await runTrellisSmoke();
  const checks = [
    doctorCheck("cloudflare.config", Boolean(wranglerConfigPath), "warn", wranglerConfigPath
      ? `found ${path.basename(wranglerConfigPath)}`
      : "no Wrangler config found in this directory"),
    doctorCheck("cloudflare.auth", Boolean(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_ACCOUNT_ID), "warn",
      "Cloudflare env auth is optional if wrangler login is already active"),
    ...[
      "TRELLIS_AGENT",
      "TRELLIS_DB",
      "TRELLIS_PACKS",
      "TRELLIS_ARTIFACTS",
      "TRELLIS_EVENTS",
      "PROSPECT_WORKFLOW",
      "AI",
      "BROWSER",
    ].map((binding) =>
      doctorCheck(`binding.${binding}`, wranglerSource.includes(binding), "warn", `${binding} binding ${wranglerSource.includes(binding) ? "declared" : "not declared"}`),
    ),
    ...provisioning.summary.resources.map((resource) =>
      doctorCheck(`cloudflare.${resource.id}`, resource.ready, "warn", resource.detail),
    ),
    doctorCheck("knowledge.pack", knowledgePack.ok, "warn", knowledgePack.detail),
    doctorCheck("skills.pack", skillPack.ok, "warn", skillPack.detail),
    ...providerReadiness.map((provider) =>
      doctorCheck(`provider.${provider.id}`, provider.ok, "warn", provider.detail),
    ),
    doctorCheck("smoke.workflow", smoke.ok, "fail", "safe fixture smoke workflow should pass"),
    doctorCheck("safety.noSends", smoke.noSendsMode, "fail", "no-send mode should be enabled before provider writes"),
  ];
  const ok = checks.every((check) => check.status !== "fail");

  if (jsonOutput) {
    emitJson({
      ok,
      command: "doctor",
      mode: "v3-cloudflare-gtm",
      checks,
      smoke: {
        ok: smoke.ok,
        fixture: smoke.fixture.id,
        auditEvents: smoke.auditEvents.map((event) => event.type),
      },
      knowledgePack: knowledgePack.summary,
      skillPack: skillPack.summary,
      providers: Object.fromEntries(providerReadiness.map((provider) => [provider.id, provider.summary])),
      cloudflare: provisioning.summary,
    });
    return;
  }

  console.log("Trellis doctor:");
  for (const check of checks) {
    console.log(`  - ${check.status}: ${check.id} - ${check.detail}`);
  }
  if (!ok) {
    process.exitCode = 1;
  }
}

function doctorCheck(
  id: string,
  passed: boolean,
  failureStatus: "warn" | "fail",
  detail: string,
) {
  return {
    id,
    status: passed ? "pass" : failureStatus,
    detail,
  };
}

async function collectMarkdownFiles(inputPath: string): Promise<string[]> {
  const details = await stat(inputPath);
  if (details.isFile()) {
    return isMarkdownFile(inputPath) ? [inputPath] : [];
  }
  if (!details.isDirectory()) {
    return [];
  }

  const entries = await readdir(inputPath, { withFileTypes: true });
  const nested = await Promise.all(entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === trellisStateDirName || entry.name.startsWith(".")) {
      return [];
    }
    const entryPath = path.join(inputPath, entry.name);
    if (entry.isDirectory()) {
      return [collectMarkdownFiles(entryPath)];
    }
    return [Promise.resolve(isMarkdownFile(entryPath) ? [entryPath] : [])];
  }));

  return nested.flat().sort((left, right) => left.localeCompare(right));
}

function isMarkdownFile(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return extension === ".md" || extension === ".mdx";
}

function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

async function writeV3ConnectionManifest(guide: (typeof V3_CONNECTIONS)[V3ConnectionId]) {
  const providerDir = path.join(process.cwd(), trellisStateDirName, "providers");
  const manifestPath = path.join(providerDir, `${guide.id}.json`);
  const missingRequiredEnv = guide.requiredEnv.filter((name) => !process.env[name]);
  const manifest = {
    version: 1,
    id: guide.id,
    kind: guide.kind,
    displayName: guide.displayName,
    connectedAt: new Date().toISOString(),
    requiredEnv: guide.requiredEnv,
    optionalEnv: guide.optionalEnv,
    capabilities: guide.capabilities,
    status: missingRequiredEnv.length === 0 ? "ready" : "waiting_for_env",
    missingRequiredEnv,
    noSecretsStored: true,
  };
  await mkdir(providerDir, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return {
    path: manifestPath,
    status: manifest.status,
    missingRequiredEnv,
  };
}

async function loadAllV3ProviderReadiness() {
  const required = await Promise.all(REQUIRED_V3_PROVIDER_IDS.map((id) => loadV3ProviderReadiness(id)));
  const optional = await Promise.all(
    OPTIONAL_V3_PROVIDER_IDS
      .filter((id) => existsSync(path.join(process.cwd(), trellisStateDirName, "providers", `${id}.json`)))
      .map((id) => loadV3ProviderReadiness(id)),
  );
  return [...required, ...optional];
}

async function loadV3ProviderReadiness(id: V3ConnectionId) {
  const guide = V3_CONNECTIONS[id];
  const manifestPath = path.join(process.cwd(), trellisStateDirName, "providers", `${id}.json`);
  const manifestExists = existsSync(manifestPath);
  const missingRequiredEnv = guide.requiredEnv.filter((name) => !process.env[name]);
  const ready = manifestExists && missingRequiredEnv.length === 0;
  return {
    id,
    ok: ready,
    detail: ready
      ? `${guide.displayName} connected and required env is present`
      : manifestExists
        ? `${guide.displayName} connected; missing env: ${missingRequiredEnv.join(", ")}`
        : `${guide.displayName} not connected yet; run trellis connect ${id}`,
    summary: {
      connected: manifestExists,
      manifestPath: manifestExists ? manifestPath : null,
      status: ready ? "ready" : (manifestExists ? "waiting_for_env" : "not_connected"),
      missingRequiredEnv,
      capabilities: guide.capabilities,
    },
  };
}

async function loadKnowledgePackManifest(cwd: string) {
  const manifestPath = path.join(cwd, trellisStateDirName, knowledgePackManifestName);
  if (!existsSync(manifestPath)) {
    const fallbackKnowledgeDir = path.join(cwd, "knowledge");
    return {
      ok: existsSync(fallbackKnowledgeDir),
      detail: existsSync(fallbackKnowledgeDir)
        ? "knowledge directory exists; run trellis docs add <path> to create a pack manifest"
        : "no knowledge pack manifest or knowledge directory found",
      summary: null,
    };
  }

  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      version?: number;
      source?: string;
      target?: string;
      files?: Array<{ path: string; bytes?: number; sha256?: string }>;
    };
    const files = manifest.files ?? [];
    const missing = files.filter((file) => !existsSync(path.join(cwd, file.path)));
    return {
      ok: files.length > 0 && missing.length === 0,
      detail: missing.length > 0
        ? `knowledge pack manifest has ${missing.length} missing file(s)`
        : `knowledge pack manifest has ${files.length} markdown file(s)`,
      summary: {
        manifestPath,
        source: manifest.source ?? null,
        target: manifest.target ?? null,
        files: files.length,
        missingFiles: missing.map((file) => file.path),
      },
    };
  } catch (error) {
    return {
      ok: false,
      detail: `knowledge pack manifest is unreadable: ${error instanceof Error ? error.message : String(error)}`,
      summary: {
        manifestPath,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function loadSkillPack(cwd: string) {
  const skillsDir = path.join(cwd, "skills");
  if (!existsSync(skillsDir)) {
    return {
      ok: false,
      detail: "no skills directory found",
      summary: null,
    };
  }

  const files = (await collectMarkdownFiles(skillsDir))
    .filter((filePath) => path.basename(filePath).toLowerCase() === "skill.md");
  return {
    ok: files.length > 0,
    detail: files.length > 0
      ? `skill pack has ${files.length} SKILL.md file(s)`
      : "skills directory exists but no SKILL.md files were found",
    summary: {
      source: "skills",
      target: "r2://TRELLIS_PACKS/skills",
      files: files.map((filePath) => toPosixPath(path.relative(cwd, filePath))),
    },
  };
}

async function collectSkillPackFilePaths(cwd: string) {
  const skillsDir = path.join(cwd, "skills");
  if (!existsSync(skillsDir)) {
    return [];
  }
  return (await collectMarkdownFiles(skillsDir))
    .filter((filePath) => path.basename(filePath).toLowerCase() === "skill.md");
}

async function readKnowledgeManifestForSync(cwd: string) {
  const manifestPath = path.join(cwd, trellisStateDirName, knowledgePackManifestName);
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      source?: string;
      files?: Array<{ path: string; bytes?: number; sha256?: string }>;
    };
    const files = (manifest.files ?? []).filter((file) => typeof file.path === "string");
    if (files.length === 0) {
      return null;
    }
    return {
      manifestPath,
      source: manifest.source ?? ".",
      files,
    };
  } catch {
    return null;
  }
}

function objectKeyForPackFile(scope: "knowledge" | "skills", source: string | undefined, relativePath: string) {
  let normalizedPath = toPosixPath(relativePath).replace(/^\/+/, "");
  const sourcePrefix = source && source !== "."
    ? `${toPosixPath(source).replace(/^\/+|\/+$/g, "")}/`
    : "";
  if (sourcePrefix && normalizedPath.startsWith(sourcePrefix)) {
    normalizedPath = normalizedPath.slice(sourcePrefix.length);
  }
  return `${scope}/files/${normalizedPath}`;
}

async function handleSmokeCommand(scope: string | undefined) {
  const resolvedScope = scope ?? "fixture-signal";
  const result = await runTrellisSmoke();
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
  if (!result.ok) {
    process.exitCode = 1;
  }

  if (jsonOutput) {
    emitJson({
      ...result,
      command: "smoke",
      scope: resolvedScope,
      knowledgePack: knowledgePack.summary,
    });
    return;
  }

  console.log(`Trellis smoke path (${resolvedScope}):

Mode:
  - ${result.mode}
  - external writes: ${result.externalWrites ? "enabled" : "blocked"}
  - no-send mode: ${result.noSendsMode ? "on" : "off"}

Checks:`);
  for (const check of result.checks) {
    console.log(`  - ${check.status}: ${check.id} - ${check.detail}`);
  }
  console.log(`
Fixture:
  - signal: ${result.fixture.id}
  - workspace: ${result.fixture.workspaceId}
  - thread: ${result.fixture.threadId}

Result:
  - workflows started: ${result.startedWorkflows.map((workflow) => workflow.name).join(", ") || "none"}
  - prospects created: ${result.prospects.length}
  - drafts created: ${result.drafts.length}
  - audit events: ${result.auditEvents.map((event) => event.type).join(", ") || "none"}
  - knowledge pack: ${knowledgePack.detail}`);
}

async function handleDeployCommand(target: string | undefined, flags: Record<string, string | boolean>) {
  const resolvedTarget = (target ?? "cloudflare").toLowerCase();
  if (resolvedTarget !== "cloudflare" && flags.legacy !== true) {
    throw new Error(
      `Deploy target "${resolvedTarget}" is legacy. Trellis v3 deploys to Cloudflare by default. Re-run with --legacy only for old local/Vercel/self-hosted migration paths.`,
    );
  }

  switch (resolvedTarget) {
    case "cloudflare":
      await handleCloudflareDeploy(flags);
      return;
    case "local":
      if (jsonOutput) {
        emitJson({
          ok: true,
          command: "deploy",
          target: "local",
          steps: [
            "npm install",
            "cp .env.example .env",
            "npm run doctor",
            "npm run dev",
          ],
          smokeMode: {
            env: {
              TRELLIS_LOCAL_SMOKE_MODE: "true",
              TRELLIS_SANDBOX_TOKEN: "local-sandbox-token",
              HANDOFF_WEBHOOK_SECRET: "local-handoff-secret",
              DASHBOARD_PASSWORD: "dev",
              DISCOVERY_LINKEDIN_ENABLED: "false",
            },
            steps: [
              "npm run doctor",
              "npm run dev",
            ],
          },
          urls: {
            dashboard: "http://localhost:3000/dashboard",
          },
        });
        return;
      }
      console.log(`Local deploy path:

  1. npm install
  2. cp .env.example .env
  3. npm run doctor
  4. npm run dev

Smoke-mode boot only:

  export TRELLIS_LOCAL_SMOKE_MODE=true
  export TRELLIS_SANDBOX_TOKEN=local-sandbox-token
  export HANDOFF_WEBHOOK_SECRET=local-handoff-secret
  export DASHBOARD_PASSWORD=dev
  export DISCOVERY_LINKEDIN_ENABLED=false
  npm run doctor
  npm run dev

Then open http://localhost:3000/dashboard`);
      return;
    case "vercel":
      if (jsonOutput) {
        emitJson({
          ok: true,
          command: "deploy",
          target: "vercel",
          requiredEnv: [
            "APP_URL",
            "CONVEX_URL or NEXT_PUBLIC_CONVEX_URL",
            "TRELLIS_SANDBOX_TOKEN",
            "TRELLIS_MCP_TOKEN",
            "DASHBOARD_PASSWORD",
            "SIGNAL_WEBHOOK_SECRET",
            "HANDOFF_WEBHOOK_SECRET",
            "Vercel sandbox / AI Gateway credentials",
            "RIVET_ENDPOINT when running on Vercel with remote Rivet",
          ],
          steps: [
            "use Node 22+",
            "run npx convex dev from the repo root",
            "boot locally first",
            "run npm run doctor until boot blockers are clear",
            "run npx convex deploy",
            "set hosted env vars in Vercel",
            "run vercel --prod",
            "verify /healthz, /dashboard, and /mcp/trellis",
            "only then wire discovery webhooks and live providers",
          ],
        });
        return;
      }
      console.log(`Vercel deploy path:

Required before deploy:
  - APP_URL
  - CONVEX_URL or NEXT_PUBLIC_CONVEX_URL
  - TRELLIS_SANDBOX_TOKEN
  - TRELLIS_MCP_TOKEN
  - DASHBOARD_PASSWORD
  - SIGNAL_WEBHOOK_SECRET
  - HANDOFF_WEBHOOK_SECRET
  - Vercel sandbox / AI Gateway credentials
  - RIVET_ENDPOINT when running on Vercel with remote Rivet

Recommended sequence:
  1. use Node 22+
  2. run npx convex dev from the repo root
  3. boot locally first
  4. run npm run doctor until boot blockers are clear
  5. run npx convex deploy
  6. set hosted env vars in Vercel
  7. run vercel --prod
  8. verify /healthz, /dashboard, and /mcp/trellis
  9. only then wire discovery webhooks and live providers`);
      return;
    case "self-hosted":
    case "selfhosted":
      if (jsonOutput) {
        emitJson({
          ok: true,
          command: "deploy",
          target: "self-hosted",
          required: [
            "public HTTPS APP_URL",
            "Node 22+",
            "reachable provider APIs",
            "reachable webhook paths for enabled providers",
          ],
          steps: [
            "npm install",
            "npm run build",
            "set production env vars",
            "npm run doctor",
            "npm run start",
            "verify /healthz, /dashboard, and /mcp/trellis",
          ],
        });
        return;
      }
      console.log(`Self-hosted deploy path:

Required:
  - public HTTPS APP_URL
  - Node 22+
  - reachable provider APIs
  - reachable webhook paths for enabled providers

Recommended sequence:
  1. npm install
  2. npm run build
  3. set production env vars
  4. npm run doctor
  5. npm run start
  6. verify /healthz, /dashboard, and /mcp/trellis`);
      return;
    default:
      throw new Error("Unknown deploy target. Use one of: cloudflare, local, vercel, self-hosted");
  }
}

async function handleCloudflareDeploy(flags: Record<string, string | boolean>) {
  const wranglerConfigPath = findWranglerConfig(process.cwd());
  const cloudflareResources = readCloudflareResourceConfig(wranglerConfigPath);
  const provisioning = buildCloudflareProvisioningPlan(cloudflareResources);
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
  const skillPack = await loadSkillPack(process.cwd());
  const providerReadiness = await loadAllV3ProviderReadiness();
  const packSync = await buildCloudflarePackSyncPlan(process.cwd(), wranglerConfigPath);
  const apply = flags.apply === true || flags.write === true || (Boolean(wranglerConfigPath) && !jsonOutput && flags["dry-run"] !== true);
  const plan = {
    ok: true,
    command: "deploy",
    target: "cloudflare",
    mode: apply ? "apply" : "plan",
    wranglerConfigPath,
    requiredAuth: [
      "Cloudflare account auth via wrangler login or CLOUDFLARE_API_TOKEN",
    ],
    provisions: [
      "Workers app",
      "Durable Objects / Cloudflare Agents bindings",
      "Workflows",
      "D1 database",
      "R2 knowledge and artifact buckets",
      "R2 pack sync for knowledge and skills",
      "Queues and dead-letter queues",
      "AI Gateway route",
      "Trellis MCP and dashboard routes",
    ],
    firstBoot: {
      requiresProviderCredentials: false,
      noSendsMode: true,
      smokeMode: true,
    },
    knowledgePack: knowledgePack.summary,
    skillPack: skillPack.summary,
    cloudflare: provisioning.summary,
    packSync: packSync.summary,
    providers: Object.fromEntries(providerReadiness.map((provider) => [provider.id, provider.summary])),
    next: [
      "trellis smoke",
      "trellis connect attio",
      "trellis connect agentmail",
      "trellis connect firecrawl",
      "trellis docs add ./product-docs",
    ],
  };

  if (!apply) {
      if (jsonOutput) {
        emitJson(plan);
        return;
      }
      console.log(`Cloudflare deploy path:

Required:
  - Cloudflare account auth via wrangler login or CLOUDFLARE_API_TOKEN

Trellis v3 provisions or verifies:
  - Workers app
  - Durable Objects / Cloudflare Agents bindings
  - Workflows
  - D1 database and Wrangler database_id
  - R2 knowledge and artifact buckets
  - R2 pack sync for knowledge and skills
  - Queues and dead-letter queues
  - AI Gateway route
  - Trellis MCP and dashboard routes

First boot:
  - no Attio/email/research credentials required
  - no-send mode enabled
  - smoke mode available before real GTM side effects

Then:
  1. trellis smoke
  2. trellis connect attio
  3. trellis connect agentmail
  4. trellis connect firecrawl
  5. trellis docs add ./product-docs`);
      return;
  }

  if (!wranglerConfigPath) {
    throw new Error("Cannot deploy: no wrangler.jsonc, wrangler.json, or wrangler.toml found in the current project.");
  }

  const provisioningResult = await applyCloudflareProvisioning(provisioning, jsonOutput);
  const verifiedProvisioning = buildCloudflareProvisioningPlan(readCloudflareResourceConfig(wranglerConfigPath));
  const packSyncResult = await syncCloudflarePacks(packSync, jsonOutput);
  const deploy = runCommand("npx", ["wrangler", "deploy"], {
    stdio: jsonOutput ? "pipe" : "inherit",
  });
  if (jsonOutput) {
    emitJson({
      ...plan,
      cloudflare: {
        ...verifiedProvisioning.summary,
        result: provisioningResult,
      },
      packSync: packSyncResult,
      deploy,
    });
  }
  if (deploy.status !== 0) {
    throw new Error(`wrangler deploy failed with exit code ${deploy.status}`);
  }
}

function buildCloudflareProvisioningPlan(config: CloudflareResourceConfig): CloudflareProvisioningPlan {
  const d1 = config.d1Databases.find((database) => database.binding === "TRELLIS_DB");
  const packsBucket = config.r2Buckets.find((bucket) => bucket.binding === "TRELLIS_PACKS");
  const artifactsBucket = config.r2Buckets.find((bucket) => bucket.binding === "TRELLIS_ARTIFACTS");
  const eventsQueue = config.queueProducers.find((queue) => queue.binding === "TRELLIS_EVENTS");
  const eventsConsumer = config.queueConsumers.find((consumer) => consumer.queue === eventsQueue?.queue);
  const d1AutoResolvable = Boolean(config.configPath && config.format === "json" && d1?.databaseName);
  const d1Ready = Boolean(d1?.databaseName && d1.databaseId);
  const r2Buckets = [
    {
      binding: "TRELLIS_PACKS" as const,
      bucketName: packsBucket?.bucketName ?? null,
      ready: Boolean(packsBucket?.bucketName),
      commands: packsBucket?.bucketName ? ["npx", "wrangler", "r2", "bucket", "create", packsBucket.bucketName] : [],
    },
    {
      binding: "TRELLIS_ARTIFACTS" as const,
      bucketName: artifactsBucket?.bucketName ?? null,
      ready: Boolean(artifactsBucket?.bucketName),
      commands: artifactsBucket?.bucketName ? ["npx", "wrangler", "r2", "bucket", "create", artifactsBucket.bucketName] : [],
    },
  ];
  const queue = {
    binding: "TRELLIS_EVENTS" as const,
    queueName: eventsQueue?.queue ?? null,
    deadLetterQueueName: eventsConsumer?.deadLetterQueue ?? null,
    ready: Boolean(eventsQueue?.queue && eventsConsumer?.deadLetterQueue),
    commands: [
      ...(eventsQueue?.queue ? [["npx", "wrangler", "queues", "create", eventsQueue.queue].join(" ")] : []),
      ...(eventsConsumer?.deadLetterQueue ? [["npx", "wrangler", "queues", "create", eventsConsumer.deadLetterQueue].join(" ")] : []),
    ],
  };
  const resources = [
    {
      id: "d1.database",
      ready: d1Ready,
      detail: d1Ready
        ? `TRELLIS_DB database ${d1?.databaseName} has database_id ${d1?.databaseId}`
        : d1?.databaseName
          ? `TRELLIS_DB database_id missing for ${d1.databaseName}; trellis deploy will resolve or create it`
          : "TRELLIS_DB needs database_name and database_id",
      commands: d1?.databaseName
        ? [
            ["npx", "wrangler", "d1", "list", "--json"].join(" "),
            ["npx", "wrangler", "d1", "create", d1.databaseName].join(" "),
          ]
        : [],
    },
    ...r2Buckets.map((bucket) => ({
      id: `r2.${bucket.binding === "TRELLIS_PACKS" ? "packsBucket" : "artifactsBucket"}`,
      ready: bucket.ready,
      detail: bucket.bucketName
        ? `${bucket.binding} bucket_name is ${bucket.bucketName}`
        : `${bucket.binding} needs bucket_name`,
      commands: bucket.commands.length > 0 ? [bucket.commands.join(" ")] : [],
    })),
    {
      id: "queue.events",
      ready: queue.ready,
      detail: queue.queueName && queue.deadLetterQueueName
        ? `TRELLIS_EVENTS queue is ${queue.queueName} with DLQ ${queue.deadLetterQueueName}`
        : queue.queueName
          ? `TRELLIS_EVENTS queue ${queue.queueName} needs a dead_letter_queue`
          : "TRELLIS_EVENTS needs a queue name",
      commands: queue.commands,
    },
  ];
  const configured = Boolean(config.configPath);
  const autoProvisionable = configured
    && Boolean(d1?.databaseName)
    && (d1Ready || d1AutoResolvable)
    && r2Buckets.every((bucket) => bucket.ready)
    && queue.ready;

  return {
    config,
    d1: {
      binding: "TRELLIS_DB",
      databaseName: d1?.databaseName ?? null,
      databaseId: d1?.databaseId ?? null,
      ready: d1Ready,
      autoResolvable: d1AutoResolvable,
      commands: d1?.databaseName
        ? ["npx", "wrangler", "d1", "create", d1.databaseName]
        : [],
    },
    r2Buckets,
    queue,
    summary: {
      configPath: config.configPath,
      readyForDeploy: configured && resources.every((resource) => resource.ready),
      autoProvisionable,
      resources,
    },
  };
}

async function applyCloudflareProvisioning(
  plan: CloudflareProvisioningPlan,
  captureOutput: boolean,
) {
  if (!plan.summary.autoProvisionable) {
    throw new Error([
      "Cloudflare resources are not provisionable from the current Wrangler config.",
      ...plan.summary.resources
        .filter((resource) => !resource.ready)
        .map((resource) => `- ${resource.id}: ${resource.detail}`),
    ].join("\n"));
  }

  const results: Array<Record<string, unknown>> = [];
  if (!captureOutput) {
    console.log("Verifying Trellis Cloudflare resources");
  }

  if (!plan.d1.ready) {
    const d1Result = ensureCloudflareD1Database(plan);
    results.push(d1Result);
    if (!captureOutput) {
      console.log(`  - D1: ${d1Result.status} ${d1Result.databaseName}`);
    }
  }

  for (const bucket of plan.r2Buckets) {
    if (!bucket.bucketName) {
      continue;
    }
    const bucketResult = createCloudflareResourceIfNeeded({
      id: `r2.${bucket.binding}`,
      command: ["npx", "wrangler", "r2", "bucket", "create", bucket.bucketName],
      alreadyExistsPattern: /already exists|already owned|bucket with this name/i,
    });
    results.push(bucketResult);
    if (!captureOutput) {
      console.log(`  - R2: ${bucketResult.status} ${bucket.bucketName}`);
    }
  }

  if (plan.queue.queueName) {
    const queueResult = createCloudflareResourceIfNeeded({
      id: "queue.TRELLIS_EVENTS",
      command: ["npx", "wrangler", "queues", "create", plan.queue.queueName],
      alreadyExistsPattern: /already exists|queue with this name/i,
    });
    results.push(queueResult);
    if (!captureOutput) {
      console.log(`  - Queue: ${queueResult.status} ${plan.queue.queueName}`);
    }
  }
  if (plan.queue.deadLetterQueueName) {
    const dlqResult = createCloudflareResourceIfNeeded({
      id: "queue.TRELLIS_EVENTS_DLQ",
      command: ["npx", "wrangler", "queues", "create", plan.queue.deadLetterQueueName],
      alreadyExistsPattern: /already exists|queue with this name/i,
    });
    results.push(dlqResult);
    if (!captureOutput) {
      console.log(`  - Queue DLQ: ${dlqResult.status} ${plan.queue.deadLetterQueueName}`);
    }
  }

  return {
    enabled: true,
    resources: results,
  };
}

function ensureCloudflareD1Database(plan: CloudflareProvisioningPlan) {
  const databaseName = plan.d1.databaseName;
  const configPath = plan.config.configPath;
  if (!databaseName || !configPath) {
    throw new Error("TRELLIS_DB database_name is missing from Wrangler config.");
  }
  if (plan.config.format !== "json") {
    throw new Error("Automatic D1 database_id updates require wrangler.json or wrangler.jsonc.");
  }

  const listBefore = runCommand("npx", ["wrangler", "d1", "list", "--json"], { stdio: "pipe" });
  const existingDatabaseId = listBefore.status === 0
    ? findD1DatabaseIdByName(listBefore.stdout, databaseName)
    : null;
  if (existingDatabaseId) {
    writeD1DatabaseIdToWranglerConfig(configPath, "TRELLIS_DB", existingDatabaseId);
    return {
      id: "d1.TRELLIS_DB",
      status: "resolved",
      databaseName,
      databaseId: existingDatabaseId,
      command: listBefore.command,
      args: listBefore.args,
    };
  }

  const create = runCommand("npx", ["wrangler", "d1", "create", databaseName], { stdio: "pipe" });
  const createdDatabaseId = parseD1DatabaseIdFromOutput(`${create.stdout ?? ""}\n${create.stderr ?? ""}`);
  if (create.status === 0 && createdDatabaseId) {
    writeD1DatabaseIdToWranglerConfig(configPath, "TRELLIS_DB", createdDatabaseId);
    return {
      id: "d1.TRELLIS_DB",
      status: "created",
      databaseName,
      databaseId: createdDatabaseId,
      command: create.command,
      args: create.args,
    };
  }

  const listAfter = runCommand("npx", ["wrangler", "d1", "list", "--json"], { stdio: "pipe" });
  const listedDatabaseId = listAfter.status === 0
    ? findD1DatabaseIdByName(listAfter.stdout, databaseName)
    : null;
  if (listedDatabaseId) {
    writeD1DatabaseIdToWranglerConfig(configPath, "TRELLIS_DB", listedDatabaseId);
    return {
      id: "d1.TRELLIS_DB",
      status: "resolved",
      databaseName,
      databaseId: listedDatabaseId,
      command: listAfter.command,
      args: listAfter.args,
    };
  }

  throw new Error([
    `Could not resolve or create D1 database ${databaseName}.`,
    "Run `npx wrangler d1 create " + databaseName + "` and copy the database_id into wrangler.jsonc.",
    create.stderr ?? create.stdout ?? "",
  ].filter(Boolean).join("\n"));
}

function createCloudflareResourceIfNeeded(options: {
  id: string;
  command: string[];
  alreadyExistsPattern: RegExp;
}) {
  const [commandName, ...args] = options.command;
  const result = runCommand(commandName ?? "npx", args, { stdio: "pipe" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const alreadyExists = result.status !== 0 && options.alreadyExistsPattern.test(output);
  if (result.status !== 0 && !alreadyExists) {
    throw new Error(`${options.command.join(" ")} failed with exit code ${result.status}\n${output}`);
  }

  return {
    id: options.id,
    status: result.status === 0 ? "created-or-verified" : "already-exists",
    command: result.command,
    args: result.args,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function buildCloudflarePackSyncPlan(cwd: string, wranglerConfigPath: string | null) {
  const bucketName = wranglerConfigPath ? readR2BucketName(wranglerConfigPath, "TRELLIS_PACKS") : null;
  const entries: Array<{
    scope: "knowledge" | "skills";
    filePath: string;
    objectKey: string;
    bytes: number;
    sha256: string;
  }> = [];

  const knowledgeManifest = await readKnowledgeManifestForSync(cwd);
  if (knowledgeManifest) {
    const manifestContents = await readFile(knowledgeManifest.manifestPath);
    entries.push({
      scope: "knowledge",
      filePath: knowledgeManifest.manifestPath,
      objectKey: "knowledge/manifest.json",
      bytes: manifestContents.byteLength,
      sha256: createHash("sha256").update(manifestContents).digest("hex"),
    });
    for (const file of knowledgeManifest.files) {
      const filePath = path.join(cwd, file.path);
      if (!existsSync(filePath)) {
        continue;
      }
      const contents = await readFile(filePath);
      entries.push({
        scope: "knowledge",
        filePath,
        objectKey: objectKeyForPackFile("knowledge", knowledgeManifest.source, file.path),
        bytes: contents.byteLength,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    }
  }

  for (const filePath of await collectSkillPackFilePaths(cwd)) {
    const contents = await readFile(filePath);
    entries.push({
      scope: "skills",
      filePath,
      objectKey: objectKeyForPackFile("skills", "skills", toPosixPath(path.relative(cwd, filePath))),
      bytes: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex"),
    });
  }

  return {
    bucketName,
    entries,
    summary: {
      enabled: entries.length > 0,
      bucketBinding: "TRELLIS_PACKS",
      bucketName,
      syncable: Boolean(bucketName) && entries.length > 0,
      entries: entries.map((entry) => ({
        scope: entry.scope,
        objectKey: entry.objectKey,
        bytes: entry.bytes,
        sha256: entry.sha256,
      })),
    },
  };
}

async function syncCloudflarePacks(
  plan: Awaited<ReturnType<typeof buildCloudflarePackSyncPlan>>,
  captureOutput: boolean,
) {
  if (plan.entries.length === 0) {
    return {
      enabled: false,
      reason: "no knowledge or skill pack files found",
      entries: [],
    };
  }
  if (!plan.bucketName) {
    return {
      enabled: false,
      reason: "TRELLIS_PACKS bucket_name missing from Wrangler config",
      entries: plan.summary.entries,
    };
  }

  if (!captureOutput) {
    console.log(`Syncing ${plan.entries.length} Trellis pack object(s) to R2 bucket ${plan.bucketName}`);
  }

  const results = plan.entries.map((entry) => {
    const result = runCommand("npx", [
      "wrangler",
      "r2",
      "object",
      "put",
      `${plan.bucketName}/${entry.objectKey}`,
      "--file",
      entry.filePath,
    ], {
      stdio: captureOutput ? "pipe" : "inherit",
    });
    return {
      scope: entry.scope,
      objectKey: entry.objectKey,
      status: result.status,
      command: result.command,
      args: result.args,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
    };
  });
  const failed = results.find((result) => result.status !== 0);
  if (failed) {
    throw new Error(`wrangler r2 object put failed for ${failed.objectKey} with exit code ${failed.status}`);
  }
  return {
    enabled: true,
    bucketName: plan.bucketName,
    entries: results,
  };
}

async function handleMcpCommand(subcommand: string | undefined, flags: Record<string, string | boolean>) {
  switch (subcommand) {
    case "claude-code":
    case "claude":
      await handleClaudeCodeMcp(flags);
      return;
    default:
      throw new Error("Unknown mcp command. Use: npm run trellis -- mcp claude-code [--local|--remote] [--write]");
  }
}

async function scaffoldV3Project(targetArg: string | undefined, flags: Record<string, string | boolean>) {
  if (flags.interactive === true || flags.wizard === true) {
    throw new Error("Interactive init is not part of Trellis v3. Run init with an explicit target and optional --name.");
  }
  if (!targetArg) {
    throw new Error("Missing target directory. Example: npm run trellis -- init ../acme-sdr --name acme-sdr");
  }

  const targetDir = path.resolve(process.cwd(), targetArg);
  const appName = String(flags.name ?? path.basename(targetDir));
  const packageName = sanitizePackageName(appName);
  const workerName = packageName.replace(/_/g, "-");

  await ensureEmptyDirectory(targetDir);
  await mkdir(path.join(targetDir, "src"), { recursive: true });
  await mkdir(path.join(targetDir, "knowledge"), { recursive: true });
  await mkdir(path.join(targetDir, "skills", "icp-qualification"), { recursive: true });
  await mkdir(path.join(targetDir, "skills", "research-brief"), { recursive: true });
  await mkdir(path.join(targetDir, "skills", "sdr-copy"), { recursive: true });
  await mkdir(path.join(targetDir, "skills", "reply-policy"), { recursive: true });
  await mkdir(path.join(targetDir, "skills", "handoff-policy"), { recursive: true });

  await writeFile(
    path.join(targetDir, "package.json"),
    JSON.stringify(buildV3ScaffoldPackage(packageName), null, 2) + "\n",
  );
  await writeFile(path.join(targetDir, "tsconfig.json"), renderV3Tsconfig());
  await writeFile(path.join(targetDir, "wrangler.jsonc"), renderV3WranglerConfig(workerName));
  await writeFile(path.join(targetDir, ".env.example"), renderV3EnvExample());
  await writeFile(path.join(targetDir, "src", "agent.ts"), renderV3AgentSource());
  await writeFile(path.join(targetDir, "src", "index.ts"), renderV3WorkerSource());
  await writeFile(path.join(targetDir, "knowledge", "icp.md"), renderV3KnowledgeSeed());
  await writeFile(path.join(targetDir, "skills", "icp-qualification", "SKILL.md"), renderV3QualificationSkill());
  await writeFile(path.join(targetDir, "skills", "research-brief", "SKILL.md"), renderV3ResearchSkill());
  await writeFile(path.join(targetDir, "skills", "sdr-copy", "SKILL.md"), renderV3CopySkill());
  await writeFile(path.join(targetDir, "skills", "reply-policy", "SKILL.md"), renderV3ReplyPolicySkill());
  await writeFile(path.join(targetDir, "skills", "handoff-policy", "SKILL.md"), renderV3HandoffPolicySkill());
  await writeFile(path.join(targetDir, "README.md"), renderV3Readme(appName));

  const nextSteps = [
    `cd ${targetDir}`,
    "npm install",
    "wrangler login",
    "trellis docs add ./knowledge",
    "trellis deploy",
    "trellis smoke",
    "trellis connect attio",
    "trellis connect agentmail",
    "trellis connect firecrawl",
  ];

  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "init",
      mode: "v3-cloudflare-gtm",
      targetDir,
      appName,
      packageName,
      filesWritten: [
        "package.json",
        "tsconfig.json",
        "wrangler.jsonc",
        ".env.example",
        "src/agent.ts",
        "src/index.ts",
        "knowledge/icp.md",
        "skills/icp-qualification/SKILL.md",
        "skills/research-brief/SKILL.md",
        "skills/sdr-copy/SKILL.md",
        "skills/reply-policy/SKILL.md",
        "skills/handoff-policy/SKILL.md",
        "README.md",
      ],
      nextSteps,
    });
    return;
  }

  console.log(`Initialized ${appName} in ${targetDir}`);
  console.log("Mode: Trellis v3 Cloudflare GTM");
  console.log("");
  console.log("Next steps:");
  nextSteps.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));
}

function buildV3ScaffoldPackage(packageName: string) {
  return {
    name: packageName,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "wrangler dev",
      deploy: "trellis deploy",
      smoke: "trellis smoke",
      typecheck: "tsc --noEmit",
      "cf:deploy": "wrangler deploy",
      "cf:tail": "wrangler tail",
    },
    dependencies: {
      "@trellis/gtm": "workspace:*",
      "@trellis/providers": "workspace:*",
      zod: "^3.25.76",
    },
    devDependencies: {
      "@cloudflare/workers-types": "^4.20260511.1",
      "@trellis/cli": "workspace:*",
      typescript: "^5.8.3",
      wrangler: "^4.90.0",
    },
  };
}

function renderV3Tsconfig() {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      types: ["@cloudflare/workers-types"],
    },
    include: ["src/**/*.ts"],
  }, null, 2) + "\n";
}

function renderV3WranglerConfig(workerName: string) {
  return `{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "${workerName}",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-12",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true
  },
  "ai": {
    "binding": "AI"
  },
  "browser": {
    "binding": "BROWSER"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "TRELLIS_AGENT",
        "class_name": "TrellisAgent"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["TrellisAgent"]
    }
  ],
  "d1_databases": [
    {
      "binding": "TRELLIS_DB",
      "database_name": "${workerName}-db"
    }
  ],
  "r2_buckets": [
    {
      "binding": "TRELLIS_PACKS",
      "bucket_name": "${workerName}-packs"
    },
    {
      "binding": "TRELLIS_ARTIFACTS",
      "bucket_name": "${workerName}-artifacts"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "TRELLIS_EVENTS",
        "queue": "${workerName}-events"
      }
    ],
    "consumers": [
      {
        "queue": "${workerName}-events",
        "dead_letter_queue": "${workerName}-events-dlq"
      }
    ]
  },
  "workflows": [
    {
      "binding": "PROSPECT_WORKFLOW",
      "name": "${workerName}-prospect",
      "class_name": "ProspectWorkflow"
    }
  ]
}
`;
}

function renderV3EnvExample() {
  return `# First deploy only needs Cloudflare auth via wrangler login or CLOUDFLARE_API_TOKEN.
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# Connect these after the app boots.
ATTIO_API_KEY=
ATTIO_DEFAULT_LIST_ID=
AGENTMAIL_API_KEY=
AGENTMAIL_WEBHOOK_SECRET=
FIRECRAWL_API_KEY=
HANDOFF_WEBHOOK_URL=
HANDOFF_WEBHOOK_SECRET=

# Optional Flue/default model override for real harness-backed skills.
TRELLIS_MODEL=

# Optional trace export. Cloudflare logs and AI Gateway remain the default.
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=
`;
}

function renderV3AgentSource() {
  return `import { trellis, schema } from "@trellis/gtm";
import { agentmail, attio, firecrawl } from "@trellis/providers";

export default trellis.agent("sdr", {
  crm: attio(),
  email: agentmail(),
  research: firecrawl(),
  knowledge: "knowledge/**/*.md",
  skills: "skills/**/SKILL.md",
  safety: trellis.safeOutbound(),
}, async (app) => {
  const signal = await app.signal();
  const context = await app.context(signal);

  if (signal.source === "reply.webhook") {
    const reply = await app.skill("reply-policy", {
      context,
      schema: schema.replyPolicy(),
    });
    const handoff = await app.skill("handoff-policy", {
      context,
      args: { reply },
      schema: schema.handoffPolicy(),
    });

    return app.workflow("reply").start({ signal, reply, handoff });
  }

  const qualification = await app.skill("icp-qualification", {
    context,
    schema: schema.qualification(),
  });
  const research = await app.skill("research-brief", {
    context,
    args: { qualification },
    schema: schema.researchBrief(),
  });
  const draft = await app.skill("sdr-copy", {
    context,
    args: { qualification, research },
    schema: schema.outboundDraft(),
  });

  return app.workflow("prospect").start({ signal, qualification, research, draft });
});
`;
}

function renderV3WorkerSource() {
  return `import { trellis } from "@trellis/gtm";
import agent from "./agent";

const runtime = trellis.cloudflare(agent);

export const TrellisAgent = runtime.TrellisAgent;
export const ProspectWorkflow = runtime.ProspectWorkflow;

export default runtime.worker;
`;
}

function renderV3KnowledgeSeed() {
  return `# ICP

Replace this with your real GTM qualification rules.

- target accounts have an urgent workflow problem
- the buyer owns GTM systems or revenue operations
- the signal includes enough context to write a useful first draft
`;
}

function renderV3QualificationSkill() {
  return `# ICP Qualification

Use the knowledge pack and signal context to decide whether the prospect is qualified, disqualified, or needs review.

Return structured output matching the qualification schema:

- decision
- summary
- confidence
- matchedEvidence
- missingEvidence
- nextStep

Do not send email or update CRM state from this skill. Draft only.
`;
}

function renderV3ResearchSkill() {
  return `# Research Brief

Use the signal, qualification, knowledge pack, and available research tools to produce a grounded account/person brief.

Return structured output matching the research brief schema:

- summary
- confidence
- evidence
- sources
- copyGuidance

Prefer concise evidence. Do not invent facts when the research tool or knowledge pack does not support them.
`;
}

function renderV3CopySkill() {
  return `# SDR Copy

Write a short outbound email draft using the qualification and research brief.

Return structured output matching the outbound draft schema:

- subject
- body
- rationale

Do not send the email. The workflow will keep the draft blocked behind Trellis approvals.
`;
}

function renderV3ReplyPolicySkill() {
  return `# Reply Policy

Classify an inbound reply and decide whether Trellis should draft a reply, pause, or hand off.

Return structured output matching the reply policy schema:

- classification
- action
- reason
- confidence
- nextStep

Choose \`handoff\` for positive replies, objections, referrals, or anything that needs human judgment. Choose \`pause\` for hard stops such as unsubscribe, bounce, wrong person, or spam risk.
`;
}

function renderV3HandoffPolicySkill() {
  return `# Handoff Policy

Decide whether an inbound reply should create a human handoff.

Return structured output matching the handoff policy schema:

- shouldHandoff
- reason
- destination
- urgency

Do not notify Slack or send webhooks from this skill. Trellis will turn the decision into an approval-gated provider action.
`;
}

function renderV3Readme(appName: string) {
  return `# ${appName}

Trellis v3 GTM agent scaffold.

## First Boot

\`\`\`bash
npm install
wrangler login
trellis docs add ./knowledge
trellis deploy
trellis smoke
\`\`\`

The first deploy is Cloudflare-first and does not require Attio, AgentMail, or Firecrawl credentials. Those are connected after the app boots:

\`\`\`bash
trellis connect attio
trellis connect agentmail
trellis connect firecrawl
trellis docs add ./product-docs
\`\`\`

Deploy syncs the verified knowledge manifest, markdown files, and tracked \`SKILL.md\` files into the \`TRELLIS_PACKS\` R2 bucket. Outbound writes stay in no-send mode until approval gates are configured.
`;
}

async function scaffoldProject(targetArg: string | undefined, flags: Record<string, string | boolean>) {
  const initInput = await resolveInitInput(targetArg, flags);
  const targetDir = path.resolve(process.cwd(), initInput.targetDirArg);
  const profile = initInput.profile;
  const appName = initInput.appName;
  const packageName = sanitizePackageName(appName);
  const baseConfig = await loadBundledBaseConfig(initInput.kitIds);
  const spec = buildScaffoldSpec(baseConfig, {
    name: packageName,
    description: `${appName} generated from the Trellis ${initInput.kitIds.length > 0 ? `${initInput.kitIds.join(", ")} kit` : "core"} scaffold.`,
    profile,
    moduleIds: initInput.moduleIds,
    kitIds: initInput.kitIds,
  });

  await ensureEmptyDirectory(targetDir);
  await mkdir(targetDir, { recursive: true });

  for (const entry of SHARED_SCAFFOLD_COPY_ENTRIES) {
    await cp(path.join(repoRoot, entry), path.join(targetDir, entry), {
      recursive: true,
    });
  }

  for (const entry of CORE_SCAFFOLD_COPY_ENTRIES) {
    await cp(path.join(coreAppRoot, entry), path.join(targetDir, entry), {
      recursive: true,
    });
  }

  for (const kitId of initInput.kitIds) {
    const kit = DOMAIN_KITS[kitId];
    for (const entry of kit.copyEntries) {
      await cp(path.join(kit.root, entry), path.join(targetDir, entry), {
        recursive: true,
      });
    }
  }

  const rootPackage = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
    version: string;
    license: string;
    type: string;
    engines: Record<string, string>;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    workspaces?: string[];
  };
  const scaffoldPackage = buildScaffoldPackage(rootPackage, spec);

  await writeFile(
    path.join(targetDir, "package.json"),
    JSON.stringify(scaffoldPackage, null, 2) + "\n",
  );
  await writeFile(path.join(targetDir, spec.configFileName), renderScaffoldConfigModule(spec));
  await writeFile(path.join(targetDir, "src", "app-config.ts"), renderScaffoldAppConfigModule(spec));
  await writeFile(path.join(targetDir, ".env.example"), renderScaffoldEnvExample(spec));
  await writeFile(path.join(targetDir, "README.md"), renderScaffoldReadme(appName, targetDir, spec));
  await writeFile(path.join(targetDir, "TRELLIS_SETUP.md"), renderScaffoldSetupChecklist(spec));

  const nextSteps = [
    `cd ${targetDir}`,
    "npm install",
    "cp .env.example .env",
    "npm run typecheck",
    "npm test",
    "npm run doctor",
    "npm run dev",
    "open TRELLIS_SETUP.md",
  ];

  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "init",
      targetDir,
      appName,
      packageName,
      profile,
      kits: initInput.kitIds,
      selection: {
        id: spec.selection.id,
        displayName: spec.selection.displayName,
        description: spec.selection.description,
      },
      modules: spec.selectedModules.map((module) => ({
        id: module.id,
        displayName: module.displayName,
        packageName: module.packageName ?? null,
      })),
      filesWritten: [
        "package.json",
        spec.configFileName,
        "src/app-config.ts",
        ".env.example",
        "README.md",
        "TRELLIS_SETUP.md",
      ],
      nextSteps,
    });
    return;
  }

  console.log(`Initialized ${appName} in ${targetDir}`);
  console.log(`Scaffold: ${spec.selection.displayName}`);
  console.log(`Composition targets: ${(spec.config.compositionTargets ?? []).join(", ")}`);
  console.log("Modules:");
  for (const module of spec.selectedModules) {
    console.log(`  - ${module.id}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log(`  1. cd ${targetDir}`);
  console.log("  2. npm install");
  console.log("  3. cp .env.example .env");
  console.log("  4. npm run typecheck");
  console.log("  5. npm test");
  console.log("  6. npm run doctor");
  console.log("  7. npm run dev");
  console.log("  8. open TRELLIS_SETUP.md");
}

async function resolveInitInput(targetArg: string | undefined, flags: Record<string, string | boolean>) {
  if (flags.interactive === true || flags.wizard === true) {
    throw new Error(
      "Interactive init has been removed. Use a Pluxx-guided Trellis onboarding plugin or run init with explicit flags, for example: npm run trellis -- init ../trellis-app --name trellis-app --with-discovery --with-deep-research --with-enrichment",
    );
  }

  if (!targetArg) {
    throw new Error(
      "Missing target directory. Run init explicitly, for example: npm run trellis -- init ../trellis-core --name trellis-core. Guided onboarding should happen through the Trellis Pluxx plugin.",
    );
  }

  if (typeof flags.profile === "string") {
    throw new Error(
      "Init profiles were removed. Trellis init now creates the core app only. Add optional lanes with --with-discovery, --with-deep-research, --with-enrichment, --with-crm, --with-email, or --with-handoff.",
    );
  }

  const profile = "core";
  const resolvedTargetArg = targetArg;
  const appName = String(flags.name ?? path.basename(path.resolve(process.cwd(), resolvedTargetArg)));
  const kitIds = resolveKitFlags(flags);
  const moduleIds = resolveInitModuleIds(profile, resolveModuleChoiceFlags(flags));
  const selection = describeScaffoldSelection({
    profile: resolveInitProfile(profile),
    selectedModuleIds: moduleIds,
  });

  if (!jsonOutput) {
    console.log(`Scaffold target: ${resolvedTargetArg}`);
    console.log(`App name: ${appName}`);
    printList("Domain kits", kitIds.length > 0 ? kitIds : ["core only"]);
    printList("Optional lanes", summarizeOptionalModuleChoices(moduleIds));
    console.log(`Resulting scaffold: ${selection.displayName}`);
    console.log("");
  }

  return {
    targetDirArg: resolvedTargetArg,
    profile,
    appName,
    moduleIds,
    kitIds,
  };
}

function resolveKitFlags(flags: Record<string, string | boolean>): DomainKitId[] {
  const raw = typeof flags.kit === "string" ? flags.kit : "";
  if (!raw) {
    return [];
  }

  const values = raw.split(",").map((value) => value.trim()).filter(Boolean);
  const normalized = [...new Set(values)];

  if (normalized.length > 1) {
    throw new Error(`Only one domain kit can be applied during init right now. Received: ${normalized.join(", ")}`);
  }

  const unknown = normalized.filter((value) => !(value in DOMAIN_KITS));
  if (unknown.length > 0) {
    throw new Error(`Unknown kit: ${unknown.join(", ")}. Available kits: ${Object.keys(DOMAIN_KITS).join(", ")}`);
  }

  return normalized as DomainKitId[];
}

function resolveModuleChoiceFlags(flags: Record<string, string | boolean>) {
  const include: string[] = [];
  const exclude: string[] = [];

  for (const choice of aiSdrInitModuleChoices) {
    if (flags[`with-${choice.id}`] === true) {
      include.push(choice.id);
    }
    if (flags[`without-${choice.id}`] === true) {
      exclude.push(choice.id);
    }
  }

  return { include, exclude };
}

async function printPlan(module: AiSdrModuleDefinition) {
  const config = await getActiveConfig();
  const plan = buildModuleInstallPlan(module, {
    installedModuleIds: (config.modules ?? []).map((item: AiSdrModuleDefinition) => item.id),
  });

  console.log(`Module: ${plan.displayName} (${plan.moduleId})`);
  console.log(`Package: ${plan.packageName ?? "not assigned"}`);
  console.log(`Status: ${plan.alreadyInstalled ? "installed" : "available"}`);
  console.log(`Provider: ${plan.providerKey ?? "not assigned"}`);
  printList("Capabilities", plan.capabilityIds);
  printList("Contracts", plan.contracts);
  printList("Providers", plan.providers);
  printList("MCP servers", plan.mcpServers);
  printList("MCP tools", plan.mcpTools);
  printList("Env", plan.envVars);
  printList("Docs", plan.docs);
  printList("Smoke checks", plan.smokeChecks);
  printList("Next steps", plan.nextSteps);
}

async function printConnectionGuide(module: AiSdrModuleDefinition) {
  const config = await getActiveConfig();
  const plan = buildModuleInstallPlan(module, {
    installedModuleIds: (config.modules ?? []).map((item: AiSdrModuleDefinition) => item.id),
  });

  console.log(`Connection guide: ${plan.displayName} (${plan.moduleId})`);
  console.log(`Provider: ${plan.providerKey ?? "not assigned"}`);
  console.log(`Package:  ${plan.packageName ?? "not assigned"}`);
  console.log(`Status:   ${plan.alreadyInstalled ? "installed" : "available"}`);
  printList("Env", plan.envVars);
  printList("Docs", plan.docs);
  printList("Smoke checks", plan.smokeChecks);
  printList("Next steps", plan.nextSteps);
}

function summarizeInstallPlan(plan: ReturnType<typeof buildModuleInstallPlan>) {
  return {
    moduleId: plan.moduleId,
    displayName: plan.displayName,
    packageName: plan.packageName ?? null,
    status: plan.alreadyInstalled ? "installed" : "available",
    providerKey: plan.providerKey ?? null,
    capabilityIds: plan.capabilityIds,
    contracts: plan.contracts,
    providers: plan.providers,
    mcpServers: plan.mcpServers,
    mcpTools: plan.mcpTools,
    envVars: plan.envVars,
    docs: plan.docs,
    smokeChecks: plan.smokeChecks,
    nextSteps: plan.nextSteps,
  };
}

async function handleClaudeCodeMcp(flags: Record<string, string | boolean>) {
  if (flags.local === true && flags.remote === true) {
    throw new Error("Choose either --local or --remote, not both.");
  }

  const useRemote = flags.remote === true;
  const url = typeof flags.url === "string"
    ? flags.url
    : (useRemote ? resolveRemoteMcpUrl() : resolveLocalMcpUrl(flags));
  const token = typeof flags.token === "string"
    ? flags.token
    : (process.env.TRELLIS_MCP_TOKEN ?? process.env.TRELLIS_SANDBOX_TOKEN ?? "REPLACE_ME");
  const tokenSource = typeof flags.token === "string"
    ? "flag"
    : (process.env.TRELLIS_MCP_TOKEN ? "TRELLIS_MCP_TOKEN"
      : (process.env.TRELLIS_SANDBOX_TOKEN ? "TRELLIS_SANDBOX_TOKEN" : "placeholder"));
  const serverName = typeof flags.name === "string" ? flags.name : "trellis";
  const builtConfig = buildClaudeCodeMcpConfig({
    serverName,
    url,
    token,
  });
  const displayConfig = buildClaudeCodeMcpConfig({
    serverName,
    url,
    token: token === "REPLACE_ME" ? token : "<redacted>",
  });
  const configJson = JSON.stringify(displayConfig, null, 2);
  let wrotePath: string | null = null;

  if (flags.write === true) {
    const targetPath = path.resolve(process.cwd(), typeof flags.path === "string" ? flags.path : ".mcp.json");
    let existingSource: string | undefined;
    try {
      existingSource = await readFile(targetPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const merged = mergeClaudeCodeMcpConfig({
      existingSource,
      serverName,
      url,
      token,
    });
    await writeFile(targetPath, merged);
    wrotePath = targetPath;
    if (!jsonOutput) {
      console.log(`Wrote Claude Code MCP config to ${targetPath}`);
      console.log("");
    }
  }

  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "mcp",
      subcommand: "claude-code",
      mode: useRemote ? "remote" : "local",
      serverName,
      url,
      tokenSource,
      wrotePath,
      config: displayConfig,
      nextSteps: [
        "Start Trellis locally or deploy it",
        "Make sure the bearer token matches TRELLIS_MCP_TOKEN or TRELLIS_SANDBOX_TOKEN",
        "Reload MCP servers in the host",
      ],
    });
    return;
  }

  console.log(configJson);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Start trellis locally or deploy it");
  console.log("  2. Make sure the bearer token matches TRELLIS_MCP_TOKEN or TRELLIS_SANDBOX_TOKEN");
  console.log("  3. Reload Claude Code MCP servers");
}

async function applyModuleToScaffold(module: AiSdrModuleDefinition) {
  const scaffoldConfigPath = resolveScaffoldConfigPath(process.cwd());
  const scaffoldConfigSource = readFileSyncSafe(scaffoldConfigPath);
  const metadata = parseScaffoldConfigMetadata(scaffoldConfigSource);
  if (!metadata) {
    throw new Error(
      `Cannot apply module "${module.id}" automatically. This works only for scaffold-generated <app>.config.ts files.`,
    );
  }

  const selectedModuleIds = new Set(metadata.selectedModuleIds);
  selectedModuleIds.add(module.id);

  const currentConfig = await importConfigFrom(scaffoldConfigPath);
  const spec = buildScaffoldSpec(currentConfig, {
    name: metadata.scaffoldName,
    description: metadata.scaffoldDescription,
    profile: metadata.selectedProfileId,
    moduleIds: [...selectedModuleIds],
    kitIds: metadata.selectedKitIds,
  });

  writeFileSyncSafe(scaffoldConfigPath, renderScaffoldConfigModule(spec));
  writeFileSyncSafe(path.join(process.cwd(), "src", "app-config.ts"), renderScaffoldAppConfigModule(spec));
  writeFileSyncSafe(path.join(process.cwd(), ".env.example"), renderScaffoldEnvExample(spec));
  writeFileSyncSafe(path.join(process.cwd(), "TRELLIS_SETUP.md"), renderScaffoldSetupChecklist(spec));
  writeFileSyncSafe(path.join(process.cwd(), "README.md"), renderScaffoldReadme(metadata.scaffoldName, process.cwd(), spec));

  const updatedFiles = [
    path.basename(scaffoldConfigPath),
    "src/app-config.ts",
    ".env.example",
    "TRELLIS_SETUP.md",
    "README.md",
  ];

  if (jsonOutput) {
    return {
      moduleId: module.id,
      scaffoldConfigPath,
      updatedFiles,
      nextSteps: [
        "Fill any new env vars from .env.example",
        "npm run trellis -- check",
        "npm run doctor",
      ],
    };
  }

  console.log(`Applied module "${module.id}" to ${scaffoldConfigPath}`);
  console.log("Updated:");
  for (const file of updatedFiles) {
    console.log(`  - ${file}`);
  }
  console.log("");
  console.log("Next steps:");
  console.log("  1. Fill any new env vars from .env.example");
  console.log("  2. npm run trellis -- check");
  console.log("  3. npm run doctor");

  return {
    moduleId: module.id,
    scaffoldConfigPath,
    updatedFiles,
    nextSteps: [
      "Fill any new env vars from .env.example",
      "npm run trellis -- check",
      "npm run doctor",
    ],
  };
}

function parseScaffoldConfigMetadata(source: string) {
  const scaffoldName = parseQuotedConst(source, "scaffoldName");
  const scaffoldDescription = parseQuotedConst(source, "scaffoldDescription");
  const selectedProfileId = parseQuotedConst(source, "selectedProfileId");
  const selectedKitIds = parseJsonConst<string[]>(source, "selectedKitIds") ?? [];
  const selectedModuleIds = parseJsonConst<string[]>(source, "selectedModuleIds");

  if (!scaffoldName || !scaffoldDescription || !selectedProfileId || !selectedModuleIds) {
    return null;
  }

  return {
    scaffoldName,
    scaffoldDescription,
    selectedProfileId,
    selectedKitIds,
    selectedModuleIds,
  };
}

function summarizeOptionalModuleChoices(selectedModuleIds: string[]) {
  const selected = aiSdrInitModuleChoices
    .filter((choice) => selectedModuleIds.includes(choice.moduleId))
    .map((choice) => `${choice.displayName} (${choice.id})`);

  return selected.length > 0 ? selected : ["core only"];
}

function resolveLocalMcpUrl(flags: Record<string, string | boolean>) {
  const port = typeof flags.port === "string" ? flags.port : (process.env.PORT ?? "3000");
  return `http://localhost:${port}/mcp/trellis`;
}

function resolveRemoteMcpUrl() {
  const appUrl = process.env.APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://your-app.example.com");
  return `${appUrl.replace(/\/$/, "")}/mcp/trellis`;
}

function parseQuotedConst(source: string, constantName: string) {
  const match = source.match(new RegExp(`const ${constantName} = (["'\`])([\\s\\S]*?)\\1;`));
  return match?.[2] ?? null;
}

function parseJsonConst<T>(source: string, constantName: string) {
  const match = source.match(new RegExp(`const ${constantName} = ([\\s\\S]*?);\\n`));
  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

function readFileSyncSafe(filePath: string) {
  return readFileSync(filePath, "utf8");
}

function writeFileSyncSafe(filePath: string, contents: string) {
  writeFileSync(filePath, contents);
}

function printList(label: string, values: string[]) {
  console.log(`${label}:`);
  if (values.length === 0) {
    console.log("  none");
    return;
  }
  for (const value of values) {
    console.log(`  - ${value}`);
  }
}

function parseCliArgs(values: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value) {
      continue;
    }
    if (!value?.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return { flags, positionals };
}

function isJsonOutput(flags: Record<string, string | boolean>) {
  return flags.json === true || flags.format === "json";
}

function emitJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function findWranglerConfig(cwd: string) {
  for (const fileName of ["wrangler.jsonc", "wrangler.json", "wrangler.toml"]) {
    const candidate = path.join(cwd, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function readCloudflareResourceConfig(configPath: string | null): CloudflareResourceConfig {
  if (!configPath) {
    return emptyCloudflareResourceConfig(null, "missing");
  }

  const source = readFileSync(configPath, "utf8");
  if (configPath.endsWith(".toml")) {
    return {
      configPath,
      format: "toml",
      d1Databases: readTomlArrayBlocks(source, "d1_databases").map((block) => ({
        binding: readTomlValue(block, "binding"),
        databaseName: readTomlValue(block, "database_name"),
        databaseId: readTomlValue(block, "database_id"),
      })),
      r2Buckets: readTomlArrayBlocks(source, "r2_buckets").map((block) => ({
        binding: readTomlValue(block, "binding"),
        bucketName: readTomlValue(block, "bucket_name"),
      })),
      queueProducers: readTomlArrayBlocks(source, "queues.producers").map((block) => ({
        binding: readTomlValue(block, "binding"),
        queue: readTomlValue(block, "queue"),
      })),
      queueConsumers: readTomlArrayBlocks(source, "queues.consumers").map((block) => ({
        queue: readTomlValue(block, "queue"),
        deadLetterQueue: readTomlValue(block, "dead_letter_queue"),
      })),
      workflows: readTomlArrayBlocks(source, "workflows").map((block) => ({
        binding: readTomlValue(block, "binding"),
        name: readTomlValue(block, "name"),
        className: readTomlValue(block, "class_name"),
      })),
    };
  }

  try {
    const parsed = JSON.parse(stripJsonComments(source)) as {
      d1_databases?: Array<{ binding?: string; database_name?: string; database_id?: string }>;
      r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
      queues?: {
        producers?: Array<{ binding?: string; queue?: string }>;
        consumers?: Array<{ queue?: string; dead_letter_queue?: string }>;
      };
      workflows?: Array<{ binding?: string; name?: string; class_name?: string }>;
    };
    return {
      configPath,
      format: "json",
      d1Databases: (parsed.d1_databases ?? []).map((database) => ({
        binding: database.binding ?? null,
        databaseName: database.database_name ?? null,
        databaseId: database.database_id ?? null,
      })),
      r2Buckets: (parsed.r2_buckets ?? []).map((bucket) => ({
        binding: bucket.binding ?? null,
        bucketName: bucket.bucket_name ?? null,
      })),
      queueProducers: (parsed.queues?.producers ?? []).map((producer) => ({
        binding: producer.binding ?? null,
        queue: producer.queue ?? null,
      })),
      queueConsumers: (parsed.queues?.consumers ?? []).map((consumer) => ({
        queue: consumer.queue ?? null,
        deadLetterQueue: consumer.dead_letter_queue ?? null,
      })),
      workflows: (parsed.workflows ?? []).map((workflow) => ({
        binding: workflow.binding ?? null,
        name: workflow.name ?? null,
        className: workflow.class_name ?? null,
      })),
    };
  } catch {
    return emptyCloudflareResourceConfig(configPath, "json");
  }
}

function emptyCloudflareResourceConfig(
  configPath: string | null,
  format: CloudflareResourceConfig["format"],
): CloudflareResourceConfig {
  return {
    configPath,
    format,
    d1Databases: [],
    r2Buckets: [],
    queueProducers: [],
    queueConsumers: [],
    workflows: [],
  };
}

function readR2BucketName(configPath: string, binding: string) {
  const source = readFileSync(configPath, "utf8");
  if (configPath.endsWith(".toml")) {
    const bucketBlockPattern = /\[\[r2_buckets\]\]([\s\S]*?)(?=\n\[\[|\n\[|$)/g;
    for (const match of source.matchAll(bucketBlockPattern)) {
      const block = match[1] ?? "";
      const bindingMatch = block.match(/binding\s*=\s*["']([^"']+)["']/);
      if (bindingMatch?.[1] !== binding) {
        continue;
      }
      return block.match(/bucket_name\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
    }
    return null;
  }

  try {
    const parsed = JSON.parse(stripJsonComments(source)) as {
      r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
    };
    return parsed.r2_buckets?.find((bucket) => bucket.binding === binding)?.bucket_name ?? null;
  } catch {
    const bindingIndex = source.indexOf(`"binding": "${binding}"`);
    if (bindingIndex === -1) {
      return null;
    }
    return source.slice(bindingIndex).match(/"bucket_name"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  }
}

function readTomlArrayBlocks(source: string, tableName: string) {
  const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockPattern = new RegExp(`\\[\\[${escapedTableName}\\]\\]([\\s\\S]*?)(?=\\n\\[\\[|\\n\\[|$)`, "g");
  return [...source.matchAll(blockPattern)].map((match) => match[1] ?? "");
}

function readTomlValue(block: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${escapedKey}\\s*=\\s*["']([^"']+)["']`));
  return match?.[1] ?? null;
}

function stripJsonComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function findD1DatabaseIdByName(stdout: string | undefined, databaseName: string) {
  if (!stdout) {
    return null;
  }
  try {
    const parsed = JSON.parse(stdout) as unknown;
    const databases = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && "result" in parsed && Array.isArray((parsed as { result?: unknown }).result)
        ? (parsed as { result: unknown[] }).result
        : [];
    for (const database of databases) {
      if (typeof database !== "object" || database === null) {
        continue;
      }
      const record = database as Record<string, unknown>;
      const name = typeof record.name === "string"
        ? record.name
        : typeof record.database_name === "string"
          ? record.database_name
          : null;
      const id = typeof record.uuid === "string"
        ? record.uuid
        : typeof record.database_id === "string"
          ? record.database_id
          : typeof record.id === "string"
            ? record.id
            : null;
      if (name === databaseName && id) {
        return id;
      }
    }
  } catch {
    return parseD1DatabaseIdFromOutput(stdout);
  }
  return null;
}

function parseD1DatabaseIdFromOutput(output: string) {
  return output.match(/database_id\s*=\s*"([^"]+)"/)?.[1]
    ?? output.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1]
    ?? output.match(/database_id:\s*([0-9a-f-]{20,})/i)?.[1]
    ?? null;
}

function writeD1DatabaseIdToWranglerConfig(configPath: string, binding: string, databaseId: string) {
  const source = readFileSync(configPath, "utf8");
  const parsed = JSON.parse(stripJsonComments(source)) as {
    d1_databases?: Array<{ binding?: string; database_id?: string }>;
  };
  const database = parsed.d1_databases?.find((entry) => entry.binding === binding);
  if (!database) {
    throw new Error(`${binding} D1 binding not found in ${path.basename(configPath)}`);
  }
  database.database_id = databaseId;
  writeFileSync(configPath, JSON.stringify(parsed, null, 2) + "\n");
}

function runCommand(
  commandName: string,
  args: string[],
  options: { stdio: "pipe" | "inherit" },
) {
  const result = spawnSync(commandName, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: options.stdio,
    encoding: "utf8",
  });

  return {
    command: commandName,
    args,
    status: result.status ?? 1,
    signal: result.signal,
    stdout: typeof result.stdout === "string" && result.stdout.length > 0 ? result.stdout : undefined,
    stderr: typeof result.stderr === "string" && result.stderr.length > 0 ? result.stderr : undefined,
    error: result.error?.message,
  };
}

async function ensureEmptyDirectory(targetDir: string) {
  try {
    const details = await stat(targetDir);
    if (!details.isDirectory()) {
      throw new Error(`target exists and is not a directory: ${targetDir}`);
    }
    const entries = await readdir(targetDir);
    if (entries.length > 0) {
      throw new Error(`target directory is not empty: ${targetDir}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function sanitizePackageName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "trellis-app";
}

function renderScaffoldReadme(
  appName: string,
  targetDir: string,
  spec: ReturnType<typeof buildScaffoldSpec>,
) {
  return `# ${appName}

This project was scaffolded from the Trellis ${spec.kitIds.length > 0 ? `${spec.kitIds.join(", ")} kit` : "core app"}.

- Stack: \`${spec.selection.id}\` (${spec.selection.displayName})
- Generated in: \`${targetDir}\`

## Stack Summary

${spec.selection.description}

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run doctor
npm run dev
\`\`\`

Then open:

\`\`\`text
http://localhost:3000/dashboard
\`\`\`

## Auth And URLs

- dashboard login uses \`DASHBOARD_PASSWORD\`, or falls back to \`TRELLIS_SANDBOX_TOKEN\`
- remote MCP auth uses bearer token \`TRELLIS_MCP_TOKEN\`, or falls back to \`TRELLIS_SANDBOX_TOKEN\`
- local MCP URL is \`http://localhost:3000/mcp/trellis\`
- deployed MCP URL is \`\${APP_URL}/mcp/trellis\`
- if you deploy on Vercel and leave \`APP_URL\` unset, the app falls back to \`https://$VERCEL_URL\`

## Add Providers Later

Examples:

\`\`\`bash
npm run trellis -- add source apify --apply
npm run trellis -- add deep-research parallel --apply
npm run trellis -- add enrichment prospeo --apply
npm run trellis -- connect source apify
npm run trellis -- mcp claude-code --local --write
\`\`\`

## Notes

- follow \`TRELLIS_SETUP.md\` for the first boot and verification path
- \`${spec.configFileName}\` controls the active modules and provider bindings
- \`packages/\` contains the extracted Trellis workspace packages used by this scaffold
- optional providers can be removed or added by editing the config and env
- this scaffold keeps the framework and provider packages local to the workspace
`;
}

async function applyKitToScaffold(kitId: DomainKitId) {
  const scaffoldConfigPath = resolveScaffoldConfigPath(process.cwd());
  const scaffoldConfigSource = readFileSyncSafe(scaffoldConfigPath);
  const metadata = parseScaffoldConfigMetadata(scaffoldConfigSource);
  if (!metadata) {
    throw new Error(
      `Cannot apply kit "${kitId}" automatically. This works only for scaffold-generated <app>.config.ts files.`,
    );
  }

  const kit = DOMAIN_KITS[kitId];
  for (const entry of kit.copyEntries) {
    cpSync(path.join(kit.root, entry), path.join(process.cwd(), entry), {
      recursive: true,
      force: true,
    });
  }

  const baseConfig = await loadBundledBaseConfig([kitId]);
  const spec = buildScaffoldSpec(baseConfig, {
    name: metadata.scaffoldName,
    description: metadata.scaffoldDescription,
    profile: metadata.selectedProfileId,
    moduleIds: metadata.selectedModuleIds,
    kitIds: [kitId],
  });

  writeFileSyncSafe(scaffoldConfigPath, renderScaffoldConfigModule(spec));
  writeFileSyncSafe(path.join(process.cwd(), "src", "app-config.ts"), renderScaffoldAppConfigModule(spec));
  writeFileSyncSafe(path.join(process.cwd(), ".env.example"), renderScaffoldEnvExample(spec));
  writeFileSyncSafe(path.join(process.cwd(), "TRELLIS_SETUP.md"), renderScaffoldSetupChecklist(spec));
  writeFileSyncSafe(path.join(process.cwd(), "README.md"), renderScaffoldReadme(metadata.scaffoldName, process.cwd(), spec));

  console.log(`Applied kit "${kitId}" to ${scaffoldConfigPath}`);
}

function resolveScaffoldConfigPath(cwd: string) {
  const candidates = readdirSync(cwd)
    .filter((entry) => entry.endsWith(".config.ts"))
    .filter((entry) => !entry.startsWith("vitest.") && !entry.startsWith("tsup."));

  if (candidates.length === 1) {
    return path.join(cwd, candidates[0] ?? "");
  }

  if (candidates.length === 0) {
    throw new Error("No scaffold config found. Expected one <app>.config.ts file in the project root.");
  }

  throw new Error(`Multiple config files found: ${candidates.join(", ")}. Expected exactly one scaffold <app>.config.ts file in the project root.`);
}

function tryResolveScaffoldConfigPath(cwd: string) {
  try {
    return resolveScaffoldConfigPath(cwd);
  } catch {
    return null;
  }
}

function pathExistsSync(candidate: string) {
  try {
    return readdirSync(path.dirname(candidate)) && Boolean(readFileSync(candidate, "utf8"));
  } catch {
    return false;
  }
}

function buildScaffoldPackage(
  rootPackage: {
    version: string;
    license: string;
    type: string;
    engines: Record<string, string>;
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    workspaces?: string[];
  },
  spec: ReturnType<typeof buildScaffoldSpec>,
) {
  const workspaceDependencies: Record<string, string> = {
    "@trellis/default-sdr": "workspace:*",
    "@trellis/framework": "workspace:*",
  };

  for (const module of spec.selectedModules) {
    if (module.packageName?.startsWith("@trellis/")) {
      workspaceDependencies[module.packageName] = "workspace:*";
    }
  }

  return {
    name: spec.config.name,
    version: rootPackage.version,
    private: true,
    license: rootPackage.license,
    type: rootPackage.type,
    engines: rootPackage.engines,
    workspaces: rootPackage.workspaces ?? ["packages/*"],
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsup src/index.ts src/mcp/trellis-server.ts --format esm --target node22 --outDir dist --clean",
      start: "node dist/index.js",
      typecheck: "tsc --noEmit",
      test: "vitest run",
      "test:watch": "vitest",
      trellis: "tsx packages/trellis-cli/src/cli.ts",
      doctor: "tsx scripts/doctor.ts",
      "trellis:sandbox:probe": "tsx scripts/sandbox-probe.ts",
    },
    dependencies: {
      ...rootPackage.dependencies,
      ...workspaceDependencies,
    },
    devDependencies: rootPackage.devDependencies,
  };
}
