import config from "../ai-sdr.config.js";
import {
  buildModuleInstallPlan,
  defaultOrchidModules,
  findModuleForAddCommand,
  type AiSdrModuleDefinition,
} from "../src/framework/index.js";

const [command, arg, providerArg] = process.argv.slice(2);

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
  npm run ai-sdr -- add <capability> <provider>

Examples:

  npm run ai-sdr -- add crm attio
  npm run ai-sdr -- add email agentmail
  npm run ai-sdr -- add search parallel
  npm run ai-sdr -- add extract firecrawl
  npm run ai-sdr -- add enrichment parallel
  npm run ai-sdr -- add state convex
  npm run ai-sdr -- add database neon
  npm run ai-sdr -- add source apify
  npm run ai-sdr -- add model vercel-ai-gateway
  npm run ai-sdr -- add runtime vercel-sandbox
  npm run ai-sdr -- add handoff slack

The alias "research" also resolves to search/extract/enrichment providers.

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
    console.error("Missing module or capability. Example: npm run ai-sdr -- add search parallel");
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
