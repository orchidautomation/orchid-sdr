import config from "../ai-sdr.config.js";
import {
  buildModuleInstallPlan,
  defaultOrchidModules,
  type AiSdrModuleDefinition,
} from "../src/framework/index.js";

const [command, arg] = process.argv.slice(2);

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
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
}

function printHelp() {
  console.log(`ai-sdr prototype commands:

  npm run ai-sdr -- modules
  npm run ai-sdr -- add <module-id>

This is a local prototype for the future framework CLI. The add command prints an install plan; it does not mutate files yet.`);
}

function listModules() {
  const installed = new Set((config.modules ?? []).map((module) => module.id));
  for (const module of defaultOrchidModules()) {
    const status = installed.has(module.id) ? "installed" : "available";
    const pkg = module.packageName ? ` ${module.packageName}` : "";
    console.log(`${module.id}\t${status}\t${module.displayName}${pkg}`);
  }
}

function printAddPlan(moduleId: string | undefined) {
  if (!moduleId) {
    console.error("Missing module id. Example: npm run ai-sdr -- add attio");
    process.exitCode = 1;
    return;
  }

  const module = defaultOrchidModules().find((item) => item.id === moduleId);
  if (!module) {
    console.error(`Unknown module: ${moduleId}`);
    process.exitCode = 1;
    return;
  }

  printPlan(module);
}

function printPlan(module: AiSdrModuleDefinition) {
  const plan = buildModuleInstallPlan(module, {
    installedModuleIds: (config.modules ?? []).map((item) => item.id),
  });

  console.log(`Module: ${plan.displayName} (${plan.moduleId})`);
  console.log(`Package: ${plan.packageName ?? "not assigned"}`);
  console.log(`Status: ${plan.alreadyInstalled ? "installed" : "available"}`);
  printList("Contracts", plan.contracts);
  printList("Providers", plan.providers);
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
