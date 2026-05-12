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
let activeConfigPromise: Promise<AiSdrConfig> | undefined;

await main();

async function main() {
  try {
    switch (command) {
      case undefined:
      case "help":
        printHelp();
        break;
      case "modules":
        await listModules();
        break;
      case "add":
        await printAddPlan(arg);
        break;
      case "check":
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
        await handleAdminCommand(arg, cliFlags);
        break;
      case "discovery":
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
    printLangfuseConnectionGuide();
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
    printV3ConnectionGuide(v3Connection);
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

function printV3ConnectionGuide(guide: (typeof V3_CONNECTIONS)[V3ConnectionId]) {
  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "connect",
      mode: "v3-provider",
      provider: guide,
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

v3 behavior:
  - credentials are connected after the Cloudflare app boots
  - smoke mode still runs without this provider
  - outbound writes stay gated by Trellis safety until approval checks pass`);
}

function printLangfuseConnectionGuide() {
  printV3ConnectionGuide(V3_CONNECTIONS.langfuse);
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
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
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
    doctorCheck("knowledge.pack", knowledgePack.ok, "warn", knowledgePack.detail),
    doctorCheck("skills.pack", existsSync(path.join(process.cwd(), "skills")), "warn", "skills directory should contain SKILL.md packs"),
    doctorCheck("provider.attio", Boolean(process.env.ATTIO_API_KEY), "warn", "Attio can be connected after first deploy"),
    doctorCheck("provider.agentmail", Boolean(process.env.AGENTMAIL_API_KEY), "warn", "AgentMail can be connected after first deploy"),
    doctorCheck("provider.firecrawl", Boolean(process.env.FIRECRAWL_API_KEY), "warn", "Firecrawl can be connected after first deploy"),
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
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
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
    next: [
      "trellis smoke",
      "trellis connect attio",
      "trellis connect agentmail",
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
  - D1 database
  - R2 knowledge and artifact buckets
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
  4. trellis docs add ./product-docs`);
      return;
  }

  if (!wranglerConfigPath) {
    throw new Error("Cannot deploy: no wrangler.jsonc, wrangler.json, or wrangler.toml found in the current project.");
  }

  const deploy = runCommand("npx", ["wrangler", "deploy"], {
    stdio: jsonOutput ? "pipe" : "inherit",
  });
  if (jsonOutput) {
    emitJson({
      ...plan,
      deploy,
    });
  }
  if (deploy.status !== 0) {
    throw new Error(`wrangler deploy failed with exit code ${deploy.status}`);
  }
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
  await writeFile(path.join(targetDir, "README.md"), renderV3Readme(appName));

  const nextSteps = [
    `cd ${targetDir}`,
    "npm install",
    "wrangler login",
    "trellis deploy",
    "trellis smoke",
    "trellis connect attio",
    "trellis connect agentmail",
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
      "binding": "TRELLIS_PACKS"
    },
    {
      "binding": "TRELLIS_ARTIFACTS"
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
        "queue": "${workerName}-events"
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
  const qualification = await app.skill("icp-qualification", {
    context: await app.context(signal),
    schema: schema.qualification(),
  });

  return app.workflow("prospect").start({ signal, qualification });
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

function renderV3Readme(appName: string) {
  return `# ${appName}

Trellis v3 GTM agent scaffold.

## First Boot

\`\`\`bash
npm install
wrangler login
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

Outbound writes stay in no-send mode until approval gates are configured.
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
