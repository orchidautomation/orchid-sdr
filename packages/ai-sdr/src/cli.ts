import { readFileSync, writeFileSync } from "node:fs";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { createClient } from "rivetkit/client";

import config from "../../../examples/ai-sdr/ai-sdr.config.js";
import { registry } from "../../../examples/ai-sdr/src/registry.js";
import {
  aiSdrCompositionProfileIds,
  buildModuleInstallPlan,
  defaultTrellisModules,
  evaluateModuleComposition,
  findModuleForAddCommand,
  type AiSdrCompositionProfileId,
  type AiSdrModuleDefinition,
} from "../../framework/src/index.js";
import {
  aiSdrInitModuleChoices,
  buildScaffoldSpec,
  describeScaffoldSelection,
  renderScaffoldConfigModule,
  renderScaffoldEnvExample,
  renderScaffoldSetupChecklist,
  resolveInitProfile,
  resolveInitModuleIds,
} from "../../framework/src/scaffold.js";
import { buildClaudeCodeMcpConfig, mergeClaudeCodeMcpConfig } from "./mcp-config.js";

const [command, ...commandArgs] = process.argv.slice(2);
const parsedCliArgs = parseCliArgs(commandArgs);
const arg = parsedCliArgs.positionals[0];
const providerArg = parsedCliArgs.positionals[1];
const cliFlags = parsedCliArgs.flags;
const jsonOutput = isJsonOutput(cliFlags);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const referenceAppRoot = path.resolve(repoRoot, "examples/ai-sdr");
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
const REFERENCE_APP_SCAFFOLD_COPY_ENTRIES = [
  "convex",
  "knowledge",
  "scripts",
  "skills",
  "src",
  "tests",
];

await main();

async function main() {
  try {
    switch (command) {
      case undefined:
      case "help":
        printHelp();
        break;
      case "modules":
        listModules();
        break;
      case "add":
        printAddPlan(arg);
        break;
      case "check":
        printCompositionCheck();
        break;
      case "connect":
        handleConnectCommand(arg);
        break;
      case "deploy":
        handleDeployCommand(arg);
        break;
      case "discovery":
        await handleDiscoveryCommand(arg, providerArg, cliFlags);
        break;
      case "mcp":
        await handleMcpCommand(arg, cliFlags);
        break;
      case "init":
        await scaffoldProject(arg, cliFlags);
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
  console.log(`ai-sdr workspace commands:

  npm run ai-sdr -- modules
  npm run ai-sdr -- check
  npm run ai-sdr -- connect <module-id>
  npm run ai-sdr -- connect <capability> <provider>
  npm run ai-sdr -- deploy <local|vercel|self-hosted>
  npm run ai-sdr -- discovery seed <term>
  npm run ai-sdr -- discovery run <term>
  npm run ai-sdr -- discovery tick
  npm run ai-sdr -- mcp claude-code [--local|--remote] [--write]
  npm run ai-sdr -- add <module-id>
  npm run ai-sdr -- add <capability> <provider>
  npm run ai-sdr -- init <target-dir> [--name my-app]
  npm run ai-sdr -- <command> --json

Examples:

  npm run ai-sdr -- add crm attio
  npm run ai-sdr -- add crm attio --apply
  npm run ai-sdr -- add email agentmail
  npm run ai-sdr -- add source apify --apply
  npm run ai-sdr -- add search firecrawl
  npm run ai-sdr -- add extract firecrawl
  npm run ai-sdr -- add deep-research parallel
  npm run ai-sdr -- add monitor parallel
  npm run ai-sdr -- add enrichment prospeo
  npm run ai-sdr -- add state convex
  npm run ai-sdr -- add runtime rivet
  npm run ai-sdr -- add source apify
  npm run ai-sdr -- modules --json
  npm run ai-sdr -- check --json
  npm run ai-sdr -- discovery seed "https://www.linkedin.com/feed/update/urn:li:activity:123/"
  npm run ai-sdr -- discovery run "https://www.linkedin.com/feed/update/urn:li:activity:123/" --source linkedin_public_post
  npm run ai-sdr -- discovery tick --source linkedin_public_post
  npm run ai-sdr -- add model vercel-ai-gateway
  npm run ai-sdr -- add runtime vercel-sandbox
  npm run ai-sdr -- add handoff slack
  npm run ai-sdr -- connect source apify
  npm run ai-sdr -- deploy vercel
  npm run ai-sdr -- deploy vercel --json
  npm run ai-sdr -- mcp claude-code --local --write
  npm run ai-sdr -- mcp claude-code --local --write --json
  npm run ai-sdr -- init ../trellis-core --name trellis-core
  npm run ai-sdr -- init ../trellis-core --name trellis-core --json
  npm run ai-sdr -- init ../trellis-core-plus --name trellis-core-plus --with-discovery --with-deep-research

Simple labels stay short in the CLI: search, extract, deep-research, monitor, enrichment.
The alias "research" resolves to the full research contract family.

Init is now a deterministic scaffold command, not an interactive wizard.
Use explicit lane flags or the future Pluxx-guided onboarding plugin.
Use --json when a plugin or coding agent is orchestrating the setup.
Use add ... --apply to layer in new providers and sources after boot.
Apply mode works on scaffold-generated workspaces.`);
}

async function handleDiscoveryCommand(
  subcommand: string | undefined,
  value: string | undefined,
  flags: Record<string, string | boolean>,
) {
  const endpoint = String(flags.endpoint ?? process.env.RIVET_CLIENT_ENDPOINT ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}/api/rivet`);
  const source = String(flags.source ?? "linkedin_public_post") as "linkedin_public_post" | "x_public_post";
  const campaignId = String(flags.campaign ?? "cmp_default");

  const client = createClient<typeof registry>({
    endpoint,
    disableMetadataLookup: true,
  });
  const actor = client.discoveryCoordinator.getOrCreate([campaignId, source]);

  switch (subcommand) {
    case "seed": {
      const term = value ?? (typeof flags.term === "string" ? flags.term : undefined);
      if (!term) {
        throw new Error("Missing discovery term. Example: npm run ai-sdr -- discovery seed \"clay workflow\"");
      }

      const result = await actor.addSeedTerms({
        source,
        terms: [term],
      });
      const snapshot = await actor.getSnapshot();
      console.log(JSON.stringify({ endpoint, result, latestTerm: snapshot.terms[0] ?? null }, null, 2));
      return;
    }
    case "run": {
      const term = value ?? (typeof flags.term === "string" ? flags.term : undefined);
      if (!term) {
        throw new Error("Missing discovery term. Example: npm run ai-sdr -- discovery run \"https://www.linkedin.com/feed/update/urn:li:activity:123/\"");
      }

      const reason = String(flags.reason ?? "manual_cli");
      const result = await actor.runTerm({
        source,
        campaignId,
        term,
        reason,
      });
      const snapshot = await actor.getSnapshot();
      console.log(JSON.stringify({ endpoint, result, latestRun: snapshot.runs[0] ?? null, state: snapshot.state }, null, 2));
      return;
    }
    case "tick": {
      const reason = String(flags.reason ?? "manual_cli");
      const result = await actor.enqueueTick({ reason });
      const snapshot = await actor.getSnapshot();
      console.log(JSON.stringify({ endpoint, result, latestRun: snapshot.runs[0] ?? null, state: snapshot.state }, null, 2));
      return;
    }
    default:
      throw new Error(
        "Unknown discovery command. Use one of: seed, run, tick",
      );
  }
}

function listModules() {
  const installed = new Set((config.modules ?? []).map((module) => module.id));
  if (jsonOutput) {
    emitJson({
      ok: true,
      command: "modules",
      modules: defaultTrellisModules().map((module) => ({
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

function printCompositionCheck() {
  const evaluations = resolveConfiguredCompositionProfiles().map((profile) =>
    evaluateModuleComposition(config.modules ?? [], { profile }),
  );
  if (jsonOutput) {
    emitJson({
      ok: evaluations.every((evaluation) => evaluation.ok),
      command: "check",
      profiles: evaluations.map((evaluation) => ({
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

function resolveConfiguredCompositionProfiles() {
  const supportedProfiles = new Set(aiSdrCompositionProfileIds);
  const configured = (config.compositionTargets ?? []).filter((profile): profile is AiSdrCompositionProfileId =>
    supportedProfiles.has(profile as AiSdrCompositionProfileId),
  );
  return configured.length > 0 ? configured : (["minimum", "productionParity"] as const);
}

function printAddPlan(moduleId: string | undefined) {
  if (!moduleId) {
    console.error("Missing module or capability. Example: npm run ai-sdr -- add search firecrawl");
    process.exitCode = 1;
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
    applyModuleToScaffold(module);
    return;
  }

  printPlan(module);
}

function handleConnectCommand(moduleId: string | undefined) {
  if (!moduleId) {
    const guides = [
      "npm run ai-sdr -- connect source apify",
      "npm run ai-sdr -- connect search firecrawl",
      "npm run ai-sdr -- connect deep-research parallel",
      "npm run ai-sdr -- connect enrichment prospeo",
      "npm run ai-sdr -- connect crm attio",
      "npm run ai-sdr -- connect email agentmail",
      "npm run ai-sdr -- connect handoff slack",
      "npm run ai-sdr -- connect mcp trellis-mcp",
    ];
    if (jsonOutput) {
      emitJson({
        ok: true,
        command: "connect",
        mode: "help",
        guides,
        notes: ["Use --apply if you also want to add the module to a scaffolded workspace first."],
      });
      return;
    }
    console.log(`Connection guides:

  npm run ai-sdr -- connect source apify
  npm run ai-sdr -- connect search firecrawl
  npm run ai-sdr -- connect deep-research parallel
  npm run ai-sdr -- connect enrichment prospeo
  npm run ai-sdr -- connect crm attio
  npm run ai-sdr -- connect email agentmail
  npm run ai-sdr -- connect handoff slack
  npm run ai-sdr -- connect mcp trellis-mcp

Use --apply if you also want to add the module to a scaffolded workspace first.`);
    return;
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
    ? applyModuleToScaffold(module)
    : null;
  if (applyResult) {
    if (!jsonOutput) {
      console.log("");
    }
  }

  if (jsonOutput) {
    const plan = buildModuleInstallPlan(module, {
      installedModuleIds: (config.modules ?? []).map((item) => item.id),
    });
    emitJson({
      ok: true,
      command: "connect",
      apply: applyResult,
      module: summarizeInstallPlan(plan),
    });
    return;
  }

  printConnectionGuide(module);
}

function handleDeployCommand(target: string | undefined) {
  const resolvedTarget = (target ?? "local").toLowerCase();

  switch (resolvedTarget) {
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
            "HANDOFF_WEBHOOK_SECRET",
            "Vercel sandbox / AI Gateway credentials",
            "RIVET_ENDPOINT when running on Vercel with remote Rivet",
          ],
          steps: [
            "boot locally first",
            "run npm run doctor until boot blockers are clear",
            "set hosted env vars in Vercel",
            "deploy",
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
  - HANDOFF_WEBHOOK_SECRET
  - Vercel sandbox / AI Gateway credentials
  - RIVET_ENDPOINT when running on Vercel with remote Rivet

Recommended sequence:
  1. boot locally first
  2. run npm run doctor until boot blockers are clear
  3. set hosted env vars in Vercel
  4. deploy
  5. verify /healthz, /dashboard, and /mcp/trellis
  6. only then wire discovery webhooks and live providers`);
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
      throw new Error("Unknown deploy target. Use one of: local, vercel, self-hosted");
  }
}

async function handleMcpCommand(subcommand: string | undefined, flags: Record<string, string | boolean>) {
  switch (subcommand) {
    case "claude-code":
    case "claude":
      await handleClaudeCodeMcp(flags);
      return;
    default:
      throw new Error("Unknown mcp command. Use: npm run ai-sdr -- mcp claude-code [--local|--remote] [--write]");
  }
}

async function scaffoldProject(targetArg: string | undefined, flags: Record<string, string | boolean>) {
  const initInput = await resolveInitInput(targetArg, flags);
  const targetDir = path.resolve(process.cwd(), initInput.targetDirArg);
  const profile = initInput.profile;
  const appName = initInput.appName;
  const packageName = sanitizePackageName(appName);
  const spec = buildScaffoldSpec(config, {
    name: packageName,
    description: `${appName} generated from the Trellis reference app scaffold.`,
    profile,
    moduleIds: initInput.moduleIds,
  });

  await ensureEmptyDirectory(targetDir);
  await mkdir(targetDir, { recursive: true });

  for (const entry of SHARED_SCAFFOLD_COPY_ENTRIES) {
    await cp(path.join(repoRoot, entry), path.join(targetDir, entry), {
      recursive: true,
    });
  }

  for (const entry of REFERENCE_APP_SCAFFOLD_COPY_ENTRIES) {
    await cp(path.join(referenceAppRoot, entry), path.join(targetDir, entry), {
      recursive: true,
    });
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
  await writeFile(path.join(targetDir, "ai-sdr.config.ts"), renderScaffoldConfigModule(spec));
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
        "ai-sdr.config.ts",
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
      "Interactive init has been removed. Use a Pluxx-guided Trellis onboarding plugin or run init with explicit flags, for example: npm run ai-sdr -- init ../trellis-ai-sdr --name trellis-ai-sdr --with-discovery --with-deep-research --with-enrichment",
    );
  }

  if (!targetArg) {
    throw new Error(
      "Missing target directory. Run init explicitly, for example: npm run ai-sdr -- init ../trellis-core --name trellis-core. Guided onboarding should happen through the Trellis Pluxx plugin.",
    );
  }

  const profile = String(flags.profile ?? "core");
  const resolvedTargetArg = targetArg;
  const appName = String(flags.name ?? path.basename(path.resolve(process.cwd(), resolvedTargetArg)));
  const moduleIds = resolveInitModuleIds(profile, resolveModuleChoiceFlags(flags));
  const selection = describeScaffoldSelection({
    profile: resolveInitProfile(profile),
    selectedModuleIds: moduleIds,
  });

  if (!jsonOutput) {
    console.log(`Scaffold target: ${resolvedTargetArg}`);
    console.log(`App name: ${appName}`);
    printList("Optional lanes", summarizeOptionalModuleChoices(moduleIds));
    console.log(`Resulting scaffold: ${selection.displayName}`);
    console.log("");
  }

  return {
    targetDirArg: resolvedTargetArg,
    profile,
    appName,
    moduleIds,
  };
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

function printPlan(module: AiSdrModuleDefinition) {
  const plan = buildModuleInstallPlan(module, {
    installedModuleIds: (config.modules ?? []).map((item) => item.id),
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

function printConnectionGuide(module: AiSdrModuleDefinition) {
  const plan = buildModuleInstallPlan(module, {
    installedModuleIds: (config.modules ?? []).map((item) => item.id),
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

function applyModuleToScaffold(module: AiSdrModuleDefinition) {
  const scaffoldConfigPath = path.join(process.cwd(), "ai-sdr.config.ts");
  const scaffoldConfigSource = readFileSyncSafe(scaffoldConfigPath);
  const metadata = parseScaffoldConfigMetadata(scaffoldConfigSource);
  if (!metadata) {
    throw new Error(
      `Cannot apply module "${module.id}" automatically. This works only for scaffold-generated ai-sdr.config.ts files.`,
    );
  }

  const selectedModuleIds = new Set(metadata.selectedModuleIds);
  selectedModuleIds.add(module.id);

  const spec = buildScaffoldSpec(config, {
    name: metadata.scaffoldName,
    description: metadata.scaffoldDescription,
    profile: metadata.selectedProfileId,
    moduleIds: [...selectedModuleIds],
  });

  writeFileSyncSafe(scaffoldConfigPath, renderScaffoldConfigModule(spec));
  writeFileSyncSafe(path.join(process.cwd(), ".env.example"), renderScaffoldEnvExample(spec));
  writeFileSyncSafe(path.join(process.cwd(), "TRELLIS_SETUP.md"), renderScaffoldSetupChecklist(spec));
  writeFileSyncSafe(path.join(process.cwd(), "README.md"), renderScaffoldReadme(metadata.scaffoldName, process.cwd(), spec));

  const updatedFiles = [
    "ai-sdr.config.ts",
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
        "npm run ai-sdr -- check",
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
  console.log("  2. npm run ai-sdr -- check");
  console.log("  3. npm run doctor");

  return {
    moduleId: module.id,
    scaffoldConfigPath,
    updatedFiles,
    nextSteps: [
      "Fill any new env vars from .env.example",
      "npm run ai-sdr -- check",
      "npm run doctor",
    ],
  };
}

function parseScaffoldConfigMetadata(source: string) {
  const scaffoldName = parseQuotedConst(source, "scaffoldName");
  const scaffoldDescription = parseQuotedConst(source, "scaffoldDescription");
  const selectedProfileId = parseQuotedConst(source, "selectedProfileId");
  const selectedModuleIds = parseJsonConst<string[]>(source, "selectedModuleIds");

  if (!scaffoldName || !scaffoldDescription || !selectedProfileId || !selectedModuleIds) {
    return null;
  }

  return {
    scaffoldName,
    scaffoldDescription,
    selectedProfileId,
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

This project was scaffolded from the Trellis reference app.

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
npm run ai-sdr -- add source apify --apply
npm run ai-sdr -- add deep-research parallel --apply
npm run ai-sdr -- add enrichment prospeo --apply
npm run ai-sdr -- connect source apify
npm run ai-sdr -- mcp claude-code --local --write
\`\`\`

## Notes

- follow \`TRELLIS_SETUP.md\` for the first boot and verification path
- \`ai-sdr.config.ts\` controls the active modules and provider bindings
- \`packages/\` contains the extracted Trellis workspace packages used by this scaffold
- optional providers can be removed or added by editing the config and env
- this scaffold preserves the current reference app behavior while keeping the framework and provider packages local to the workspace
`;
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
    "@ai-sdr/framework": "workspace:*",
  };

  for (const module of spec.selectedModules) {
    if (module.packageName?.startsWith("@ai-sdr/")) {
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
      "ai-sdr": "tsx packages/ai-sdr/src/cli.ts",
      doctor: "tsx scripts/doctor.ts",
      "discovery:tick": "tsx scripts/discovery-tick.ts",
      "sandbox:probe": "tsx scripts/sandbox-probe.ts",
    },
    dependencies: {
      ...rootPackage.dependencies,
      ...workspaceDependencies,
    },
    devDependencies: rootPackage.devDependencies,
  };
}
