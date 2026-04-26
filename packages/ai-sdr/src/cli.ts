import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "../../../ai-sdr.config.js";
import {
  aiSdrCompositionProfileIds,
  buildModuleInstallPlan,
  defaultOrchidModules,
  evaluateModuleComposition,
  findModuleForAddCommand,
  type AiSdrCompositionProfileId,
  type AiSdrModuleDefinition,
} from "../../framework/src/index.js";
import {
  buildScaffoldSpec,
  renderScaffoldConfigModule,
  renderScaffoldEnvExample,
  renderScaffoldSetupChecklist,
} from "../../framework/src/scaffold.js";

const [command, ...commandArgs] = process.argv.slice(2);
const arg = commandArgs[0];
const providerArg = commandArgs[1] && !commandArgs[1].startsWith("--")
  ? commandArgs[1]
  : undefined;
const cliFlags = parseFlags(commandArgs.slice(providerArg ? 2 : 1));
const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCAFFOLD_COPY_ENTRIES = [
  ".dockerignore",
  ".gitignore",
  "Dockerfile",
  "docker-compose.example.yml",
  "convex",
  "docs",
  "knowledge",
  "packages",
  "scripts",
  "skills",
  "src",
  "tests",
  "tsconfig.json",
  "vercel.json",
];

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
  case "init":
    await scaffoldProject(arg, cliFlags);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
}

function printHelp() {
  console.log(`ai-sdr workspace commands:

  npm run ai-sdr -- modules
  npm run ai-sdr -- check
  npm run ai-sdr -- add <module-id>
  npm run ai-sdr -- add <capability> <provider>
  npm run ai-sdr -- init <target-dir> [--profile core|starter|production] [--name my-app]

Examples:

  npm run ai-sdr -- add crm attio
  npm run ai-sdr -- add email agentmail
  npm run ai-sdr -- add search firecrawl
  npm run ai-sdr -- add extract firecrawl
  npm run ai-sdr -- add deep-research parallel
  npm run ai-sdr -- add monitor parallel
  npm run ai-sdr -- add enrichment prospeo
  npm run ai-sdr -- add state convex
  npm run ai-sdr -- add runtime rivet
  npm run ai-sdr -- add source apify
  npm run ai-sdr -- add model vercel-ai-gateway
  npm run ai-sdr -- add runtime vercel-sandbox
  npm run ai-sdr -- add handoff slack
  npm run ai-sdr -- init ../trellis-starter --profile starter --name trellis-starter

Simple labels stay short in the CLI: search, extract, deep-research, monitor, enrichment.
The alias "research" resolves to the full research contract family.

Init currently scaffolds a working reference app from this repo template with a filtered module/config surface.`);
}

function listModules() {
  const installed = new Set((config.modules ?? []).map((module) => module.id));
  for (const module of defaultOrchidModules()) {
    const status = installed.has(module.id) ? "installed" : "available";
    const pkg = module.packageName ? ` ${module.packageName}` : "";
    console.log(`${module.id}\t${status}\t${module.displayName}${pkg}`);
  }
}

function printCompositionCheck() {
  for (const profile of resolveConfiguredCompositionProfiles()) {
    const evaluation = evaluateModuleComposition(config.modules ?? [], { profile });
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

  const module = findModuleForAddCommand(defaultOrchidModules(), {
    capabilityOrModule: moduleId,
    provider: providerArg,
  });
  if (!module) {
    const requested = providerArg ? `${moduleId} ${providerArg}` : moduleId;
    console.error(`Unknown module or provider capability: ${requested}`);
    process.exitCode = 1;
    return;
  }

  printPlan(module);
}

async function scaffoldProject(targetArg: string | undefined, flags: Record<string, string | boolean>) {
  if (!targetArg) {
    console.error("Missing target directory. Example: npm run ai-sdr -- init ../trellis-starter --profile starter");
    process.exitCode = 1;
    return;
  }

  const targetDir = path.resolve(process.cwd(), targetArg);
  const profile = String(flags.profile ?? "starter");
  const appName = String(flags.name ?? path.basename(targetDir));
  const packageName = sanitizePackageName(appName);
  const spec = buildScaffoldSpec(config, {
    name: packageName,
    description: `${appName} generated from the Trellis reference app scaffold.`,
    profile,
  });

  await ensureEmptyDirectory(targetDir);
  await mkdir(targetDir, { recursive: true });

  for (const entry of SCAFFOLD_COPY_ENTRIES) {
    await cp(path.join(scriptRoot, entry), path.join(targetDir, entry), {
      recursive: true,
    });
  }

  const rootPackage = JSON.parse(await readFile(path.join(scriptRoot, "package.json"), "utf8")) as {
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
  await writeFile(path.join(targetDir, "README.md"), renderScaffoldReadme(appName, targetDir, spec.profile.id));
  await writeFile(path.join(targetDir, "TRELLIS_SETUP.md"), renderScaffoldSetupChecklist(spec));

  console.log(`Initialized ${appName} in ${targetDir}`);
  console.log(`Profile: ${spec.profile.displayName}`);
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

function parseFlags(values: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value?.startsWith("--")) {
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

  return flags;
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

function renderScaffoldReadme(appName: string, targetDir: string, profileId: string) {
  return `# ${appName}

This project was scaffolded from the Trellis reference app.

- Profile: \`${profileId}\`
- Generated in: \`${targetDir}\`

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
    scripts: rootPackage.scripts,
    dependencies: {
      ...rootPackage.dependencies,
      ...workspaceDependencies,
    },
    devDependencies: rootPackage.devDependencies,
  };
}
