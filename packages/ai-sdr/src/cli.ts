import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";

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
  aiSdrInitProfiles,
  aiSdrInitModuleChoices,
  buildScaffoldSpec,
  isInitModuleEnabled,
  renderScaffoldConfigModule,
  renderScaffoldEnvExample,
  renderScaffoldSetupChecklist,
  resolveInitProfile,
  resolveInitModuleIds,
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
    console.error(message);
    process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`ai-sdr workspace commands:

  npm run ai-sdr -- modules
  npm run ai-sdr -- check
  npm run ai-sdr -- add <module-id>
  npm run ai-sdr -- add <capability> <provider>
  npm run ai-sdr -- init [target-dir] [--profile core|starter|production] [--name my-app]

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
  npm run ai-sdr -- init
  npm run ai-sdr -- init ../trellis-starter --profile starter --name trellis-starter
  npm run ai-sdr -- init ../trellis-core-plus --profile core --with-discovery --with-deep-research

Simple labels stay short in the CLI: search, extract, deep-research, monitor, enrichment.
The alias "research" resolves to the full research contract family.

Init can now launch an interactive wizard if you omit the target directory.`);
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
  await writeFile(path.join(targetDir, "README.md"), renderScaffoldReadme(appName, targetDir, spec.profile));
  await writeFile(path.join(targetDir, "TRELLIS_SETUP.md"), renderScaffoldSetupChecklist(spec));

  console.log(`Initialized ${appName} in ${targetDir}`);
  console.log(`Profile: ${spec.profile.displayName}`);
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
  const shouldPrompt = !targetArg || flags.interactive === true || flags.wizard === true;
  if (!shouldPrompt) {
    const profile = String(flags.profile ?? "starter");
    const resolvedTargetArg = targetArg;
    const appName = String(flags.name ?? path.basename(path.resolve(process.cwd(), resolvedTargetArg)));
    return {
      targetDirArg: resolvedTargetArg,
      profile,
      appName,
      moduleIds: resolveInitModuleIds(profile, resolveModuleChoiceFlags(flags)),
    };
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive init requires a TTY. Re-run with a target directory, for example: npm run ai-sdr -- init ../trellis-starter --profile starter",
    );
  }

  return await promptForInit({
    targetArg,
    profile: typeof flags.profile === "string" ? flags.profile : undefined,
    name: typeof flags.name === "string" ? flags.name : undefined,
    ...resolveModuleChoiceFlags(flags),
  });
}

async function promptForInit(input: {
  targetArg?: string;
  profile?: string;
  name?: string;
  include?: string[];
  exclude?: string[];
}) {
  const profiles = Object.values(aiSdrInitProfiles);
  const defaultProfile = resolveInitProfile(input.profile ?? "starter");
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("Trellis init wizard");
    console.log("");
    console.log("Choose a scaffold profile:");
    for (const [index, profile] of profiles.entries()) {
      const defaultLabel = profile.id === defaultProfile.id ? " (default)" : "";
      console.log(`  ${index + 1}. ${profile.displayName}${defaultLabel}`);
      console.log(`     ${profile.description}`);
    }
    console.log("");

    const profileAnswer = await readline.question(`Profile [1-${profiles.length}] (${defaultProfile.id}): `);
    const selectedProfile = resolveWizardProfile(profileAnswer, profiles, defaultProfile.id);
    const selectedModules = new Set(resolveInitModuleIds(selectedProfile.id, {
      include: input.include,
      exclude: input.exclude,
    }));
    const lockedChoices = new Set([...(input.include ?? []), ...(input.exclude ?? [])]);
    const defaultTarget = input.targetArg ?? `../${selectedProfile.defaultDirectoryName}`;
    const targetAnswer = await readline.question(`Target directory (${defaultTarget}): `);
    const resolvedTargetArg = (targetAnswer.trim() || defaultTarget).trim();
    const defaultName = input.name ?? path.basename(path.resolve(process.cwd(), resolvedTargetArg));
    const nameAnswer = await readline.question(`Project name (${defaultName}): `);
    const appName = (nameAnswer.trim() || defaultName).trim();

    console.log("");
    console.log("Optional modules:");
    for (const choice of aiSdrInitModuleChoices) {
      if (lockedChoices.has(choice.id) || lockedChoices.has(choice.moduleId)) {
        continue;
      }

      const defaultEnabled = selectedModules.has(choice.moduleId) || isInitModuleEnabled(selectedProfile, choice);
      const answer = await readline.question(
        `${choice.displayName} (${defaultEnabled ? "Y/n" : "y/N"}): `,
      );
      const enabled = parseYesNoAnswer(answer, defaultEnabled);
      if (enabled) {
        selectedModules.add(choice.moduleId);
      } else {
        selectedModules.delete(choice.moduleId);
      }
    }

    console.log("");
    console.log(`Scaffold: ${selectedProfile.displayName}`);
    console.log(`Target:   ${resolvedTargetArg}`);
    console.log(`Name:     ${appName}`);
    console.log("");

    return {
      targetDirArg: resolvedTargetArg,
      profile: selectedProfile.id,
      appName,
      moduleIds: [...selectedModules],
    };
  } finally {
    readline.close();
  }
}

function resolveWizardProfile(answer: string, profiles: (typeof aiSdrInitProfiles)[keyof typeof aiSdrInitProfiles][], fallbackProfileId: string) {
  const trimmed = answer.trim();
  if (!trimmed) {
    return resolveInitProfile(fallbackProfileId);
  }

  const numericIndex = Number.parseInt(trimmed, 10);
  if (Number.isFinite(numericIndex) && numericIndex >= 1 && numericIndex <= profiles.length) {
    return profiles[numericIndex - 1] ?? resolveInitProfile(fallbackProfileId);
  }

  return resolveInitProfile(trimmed);
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

function parseYesNoAnswer(answer: string, fallback: boolean) {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["y", "yes"].includes(normalized)) {
    return true;
  }
  if (["n", "no"].includes(normalized)) {
    return false;
  }
  return fallback;
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

function renderScaffoldReadme(
  appName: string,
  targetDir: string,
  profile: { id: string; displayName: string; description: string },
) {
  return `# ${appName}

This project was scaffolded from the Trellis reference app.

- Profile: \`${profile.id}\` (${profile.displayName})
- Generated in: \`${targetDir}\`

## Profile Summary

${profile.description}

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

- dashboard login uses \`DASHBOARD_PASSWORD\`, or falls back to \`ORCHID_SDR_SANDBOX_TOKEN\`
- remote MCP auth uses bearer token \`ORCHID_SDR_MCP_TOKEN\`, or falls back to \`ORCHID_SDR_SANDBOX_TOKEN\`
- local MCP URL is \`http://localhost:3000/mcp/orchid-sdr\`
- deployed MCP URL is \`\${APP_URL}/mcp/orchid-sdr\`
- if you deploy on Vercel and leave \`APP_URL\` unset, the app falls back to \`https://$VERCEL_URL\`

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
