import { access, readFile } from "node:fs/promises";
import path from "node:path";

import config from "../ai-sdr.config.js";
import {
  collectConfigEnv,
  collectKnowledgePaths,
  collectSkillPaths,
  type AiSdrEnvVar,
} from "../src/framework/index.js";

type Check = {
  label: string;
  ok: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
};

const strictEnv = process.argv.includes("--strict-env");
const root = process.cwd();

const checks: Check[] = [];

await checkConfigReferences();
await checkEnvExample();
checkRuntimeEnv();

for (const check of checks) {
  const icon = check.ok ? "ok" : check.severity;
  const suffix = check.detail ? ` - ${check.detail}` : "";
  console.log(`${icon}: ${check.label}${suffix}`);
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

async function checkEnvExample() {
  const envExample = await readFile(path.join(root, ".env.example"), "utf8").catch(() => "");
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
    const ok = Boolean(process.env[envVar.name]);
    checks.push({
      label: `runtime env ${envVar.name}`,
      ok,
      severity: strictEnv ? "error" : "warning",
      detail: ok ? undefined : strictEnv ? "missing required env" : "missing in current shell; rerun with --strict-env to fail",
    });
  }
}

function isRequiredEnv(envVar: AiSdrEnvVar) {
  return Boolean(envVar.required);
}

async function pathExists(filePath: string) {
  try {
    await access(path.join(root, filePath));
    return true;
  } catch {
    return false;
  }
}
