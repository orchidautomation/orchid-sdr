import { access, readFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "../ai-sdr.config.js";
import {
  aiSdrCompositionProfileIds,
  collectConfigEnv,
  collectKnowledgePaths,
  collectModuleDocs,
  collectSkillPaths,
  evaluateModuleComposition,
  validateAiSdrConfigReferences,
  type AiSdrCompositionProfileId,
  type AiSdrEnvVar,
} from "@ai-sdr/framework";
import { getFrameworkRuntimeConfig } from "../src/services/framework-stack.js";
import { buildRuntimeReadinessChecks } from "../src/services/doctor-readiness.js";

type Check = {
  label: string;
  ok: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
  envNames?: string[];
  fixGroup?: "boot" | "discovery" | "optional";
};

const strictEnv = process.argv.includes("--strict-env");
const jsonOutput = process.argv.includes("--json") || process.argv.includes("--format=json");
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = findAppRoot([moduleDir, process.cwd()]);
const workspaceRoot = findWorkspaceRoot(appRoot);
const readinessCoveredEnv = new Set([
  "CONVEX_URL",
  "NEXT_PUBLIC_CONVEX_URL",
  "TRELLIS_SANDBOX_TOKEN",
  "HANDOFF_WEBHOOK_SECRET",
]);

const checks: Check[] = [];

await checkConfigReferences();
checkConfigComposition();
for (const profile of resolveConfiguredCompositionProfiles()) {
  checkRequiredModuleComposition(profile);
}
await checkModuleDocs();
await checkEnvExample();
checkRuntimeEnv();
checkRuntimeReadiness();

if (jsonOutput) {
  const fixNext = collectFixNext();
  console.log(JSON.stringify({
    ok: checks.every((check) => check.ok || check.severity !== "error"),
    strictEnv,
    checks,
    fixNext: {
      groups: {
        boot: fixNext.grouped.get("boot") ?? [],
        discovery: fixNext.grouped.get("discovery") ?? [],
        optional: fixNext.grouped.get("optional") ?? [],
      },
      hasSmokeHint: fixNext.hasSmokeHint,
    },
  }, null, 2));
} else {
  for (const check of checks) {
    const icon = check.ok ? "ok" : check.severity;
    const suffix = check.detail ? ` - ${check.detail}` : "";
    console.log(`${icon}: ${check.label}${suffix}`);
  }

  printFixNextBlock();
}

const errors = checks.filter((check) => !check.ok && check.severity === "error");
if (errors.length > 0) {
  process.exitCode = 1;
}

async function checkConfigReferences() {
  checks.push({
    label: `loaded AI SDR config "${config.name}"`,
    ok: true,
    severity: "info",
  });

  for (const filePath of collectKnowledgePaths(config)) {
    const ok = await pathExists(filePath);
    checks.push({
      label: `knowledge file ${filePath}`,
      ok,
      severity: "error",
      detail: ok ? undefined : "missing referenced knowledge file",
    });
  }

  for (const skillPath of collectSkillPaths(config)) {
    const skillFile = path.join(skillPath, "SKILL.md");
    const ok = await pathExists(skillFile);
    checks.push({
      label: `skill ${skillPath}`,
      ok,
      severity: "error",
      detail: ok ? undefined : "missing SKILL.md",
    });
  }
}

function checkConfigComposition() {
  const issues = validateAiSdrConfigReferences(config);
  if (issues.length === 0) {
    checks.push({
      label: "AI SDR config composition",
      ok: true,
      severity: "info",
    });
    return;
  }

  for (const issue of issues) {
    checks.push({
      label: `AI SDR config ${issue.code}`,
      ok: false,
      severity: issue.severity,
      detail: issue.message,
    });
  }
}

function checkRequiredModuleComposition(profile: AiSdrCompositionProfileId) {
  const evaluation = evaluateModuleComposition(config.modules ?? [], { profile });
  if (evaluation.ok) {
    checks.push({
      label: `${evaluation.profile.displayName} module composition`,
      ok: true,
      severity: "info",
      detail: `${evaluation.providedCapabilities.length} capabilities, ${evaluation.providedContracts.length} contracts`,
    });
    return;
  }

  checks.push({
    label: `${evaluation.profile.displayName} module composition`,
    ok: false,
    severity: "error",
    detail: [
      evaluation.missingCapabilities.length > 0
        ? `missing capabilities: ${evaluation.missingCapabilities.join(", ")}`
        : "",
      evaluation.missingContracts.length > 0
        ? `missing contracts: ${evaluation.missingContracts.join(", ")}`
        : "",
    ].filter(Boolean).join("; "),
  });
}

function resolveConfiguredCompositionProfiles(): AiSdrCompositionProfileId[] {
  const supportedProfiles = new Set(aiSdrCompositionProfileIds);
  const configured = (config.compositionTargets ?? []).filter((profile): profile is AiSdrCompositionProfileId =>
    supportedProfiles.has(profile as AiSdrCompositionProfileId),
  );

  return configured.length > 0 ? configured : ["minimum", "productionParity"];
}

async function checkModuleDocs() {
  for (const doc of collectModuleDocs(config)) {
    const filePath = doc.path.split("#")[0] ?? doc.path;
    const ok = await pathExists(filePath, { allowWorkspaceFallback: true });
    checks.push({
      label: `module doc ${doc.label}`,
      ok,
      severity: "warning",
      detail: ok ? doc.path : `missing referenced doc ${doc.path}`,
    });
  }
}

async function checkEnvExample() {
  const envExample = await readTextFromRoots(".env.example");
  if (!envExample) {
    checks.push({
      label: ".env.example",
      ok: false,
      severity: "error",
      detail: "missing .env.example",
    });
    return;
  }

  for (const envVar of collectConfigEnv(config)) {
    checks.push({
      label: `.env.example includes ${envVar.name}`,
      ok: envExample.includes(`${envVar.name}=`),
      severity: envVar.required ? "error" : "warning",
      detail: envExample.includes(`${envVar.name}=`)
        ? undefined
        : envVar.required
          ? "required runtime env is not documented"
          : "optional provider env is not documented",
    });
  }
}

function checkRuntimeEnv() {
  for (const envVar of collectConfigEnv(config).filter(isRequiredEnv)) {
    if (readinessCoveredEnv.has(envVar.name)) {
      continue;
    }
    const ok = Boolean(process.env[envVar.name]);
    checks.push({
      label: `runtime env ${envVar.name}`,
      ok,
      severity: strictEnv ? "error" : "warning",
      detail: ok ? undefined : strictEnv ? "missing required env" : "missing in current shell; rerun with --strict-env to fail",
    });
  }
}

function checkRuntimeReadiness() {
  const framework = getFrameworkRuntimeConfig();
  const readinessChecks = buildRuntimeReadinessChecks({
    env: process.env,
    framework,
  });

  for (const check of readinessChecks) {
    checks.push(check);
  }
}

function printFixNextBlock() {
  const { grouped, hasSmokeHint } = collectFixNext();

  if (grouped.size === 0 && !hasSmokeHint) {
    return;
  }

  console.log("");
  console.log("Fix these envs next:");

  printFixGroup(grouped, "boot", "  boot");
  printFixGroup(grouped, "discovery", "  discovery");
  printFixGroup(grouped, "optional", "  optional");

  if (hasSmokeHint) {
    console.log("  local boot-only smoke mode");
    console.log("    - TRELLIS_LOCAL_SMOKE_MODE=true");
    console.log("    - TRELLIS_SANDBOX_TOKEN=<local-dev-token>");
    console.log("    - HANDOFF_WEBHOOK_SECRET=<local-dev-secret>");
  }
}

function collectFixNext() {
  const grouped = new Map<NonNullable<Check["fixGroup"]>, string[]>();

  for (const check of checks) {
    if (check.ok || !check.fixGroup || !check.envNames?.length) {
      continue;
    }

    const existing = grouped.get(check.fixGroup) ?? [];
    const rendered = check.envNames.join(" or ");
    if (!existing.includes(rendered)) {
      existing.push(rendered);
    }
    grouped.set(check.fixGroup, existing);
  }

  const hasSmokeHint = process.env.TRELLIS_LOCAL_SMOKE_MODE !== "true"
    && checks.some((check) => check.label === "boot readiness: Convex state plane URL" && !check.ok);

  return { grouped, hasSmokeHint };
}

function printFixGroup(
  grouped: Map<NonNullable<Check["fixGroup"]>, string[]>,
  key: NonNullable<Check["fixGroup"]>,
  label: string,
) {
  const values = grouped.get(key);
  if (!values || values.length === 0) {
    return;
  }

  console.log(label);
  for (const value of values) {
    console.log(`    - ${value}`);
  }
}

function isRequiredEnv(envVar: AiSdrEnvVar) {
  return Boolean(envVar.required);
}

function findAppRoot(startDirs: string[]) {
  for (const startDir of startDirs) {
    let current = path.resolve(startDir);

    while (true) {
      if (fs.existsSync(path.join(current, "ai-sdr.config.ts"))) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }

      current = parent;
    }
  }

  return process.cwd();
}

function findWorkspaceRoot(startDir: string) {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, "package.json")) && fs.existsSync(path.join(current, "packages"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }

    current = parent;
  }
}

async function readTextFromRoots(relativePath: string) {
  for (const base of [appRoot, workspaceRoot]) {
    try {
      return await readFile(path.join(base, relativePath), "utf8");
    } catch {
      continue;
    }
  }

  return "";
}

async function pathExists(
  filePath: string,
  options: {
    allowWorkspaceFallback?: boolean;
  } = {},
) {
  for (const base of options.allowWorkspaceFallback ? [appRoot, workspaceRoot] : [appRoot]) {
    try {
      await access(path.join(base, filePath));
      return true;
    } catch {
      continue;
    }
  }

  return false;
}
