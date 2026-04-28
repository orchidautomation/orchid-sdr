import type { FrameworkRuntimeConfig } from "./framework-stack.js";

export type DoctorCheck = {
  label: string;
  ok: boolean;
  detail?: string;
  severity: "error" | "warning" | "info";
  envNames?: string[];
  fixGroup?: "boot" | "discovery" | "optional";
};

type EnvMap = Record<string, string | undefined>;

export function buildRuntimeReadinessChecks(input: {
  env: EnvMap;
  framework: FrameworkRuntimeConfig;
}): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const { env, framework } = input;
  const localSmokeMode = envFlagEnabled(env, "TRELLIS_LOCAL_SMOKE_MODE", false);

  if (localSmokeMode) {
    checks.push({
      label: "local smoke mode",
      ok: true,
      severity: "info",
      detail: "boot/dashboard verification mode enabled; discovery and full workflow readiness checks are downgraded",
    });
  }

  if (framework.selections.state.providerId === "convex" && !localSmokeMode) {
    checks.push(buildAnyEnvCheck({
      env,
      names: ["CONVEX_URL", "NEXT_PUBLIC_CONVEX_URL"],
      label: "boot readiness: Convex state plane URL",
      severity: "error",
      missingDetail: "set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL",
      fixGroup: "boot",
    }));
  }

  if (framework.selections.runtimeSandbox.providerId === "vercel-sandbox") {
    checks.push(buildRequiredEnvCheck({
      env,
      name: "TRELLIS_SANDBOX_TOKEN",
      label: "boot readiness: sandbox token",
      severity: "error",
      fixGroup: "boot",
    }));
  }

  checks.push(buildRequiredEnvCheck({
    env,
    name: "HANDOFF_WEBHOOK_SECRET",
    label: "boot readiness: handoff webhook secret",
    severity: "error",
    fixGroup: "boot",
  }));

  if (framework.selections.sourceDiscovery.providerId === "apify-linkedin") {
    if (!envFlagEnabled(env, "DISCOVERY_LINKEDIN_ENABLED", true)) {
      checks.push({
        label: "LinkedIn discovery readiness",
        ok: true,
        severity: "info",
        detail: "DISCOVERY_LINKEDIN_ENABLED=false",
      });
    } else {
      const discoverySeverity: DoctorCheck["severity"] = localSmokeMode ? "warning" : "error";
      checks.push(buildRequiredEnvCheck({
        env,
        name: "APIFY_TOKEN",
        label: "LinkedIn discovery readiness: APIFY_TOKEN",
        severity: discoverySeverity,
        fixGroup: "discovery",
      }));
      checks.push(buildAnyEnvCheck({
        env,
        names: ["APIFY_LINKEDIN_TASK_ID", "APIFY_LINKEDIN_ACTOR_ID"],
        label: "LinkedIn discovery readiness: keyword search actor/task",
        severity: discoverySeverity,
        missingDetail: "set APIFY_LINKEDIN_TASK_ID or APIFY_LINKEDIN_ACTOR_ID",
        fixGroup: "discovery",
      }));
      checks.push(buildAnyEnvCheck({
        env,
        names: ["APIFY_LINKEDIN_POSTS_TASK_ID", "APIFY_LINKEDIN_POSTS_ACTOR_ID"],
        label: "Exact LinkedIn post discovery readiness",
        severity: "warning",
        missingDetail: "set APIFY_LINKEDIN_POSTS_TASK_ID or APIFY_LINKEDIN_POSTS_ACTOR_ID for exact post URL routing",
        fixGroup: "optional",
      }));
      checks.push(buildAnyEnvCheck({
        env,
        names: ["APIFY_LINKEDIN_PROFILE_TASK_ID", "APIFY_LINKEDIN_PROFILE_ACTOR_ID"],
        label: "LinkedIn profile/company research readiness",
        severity: "warning",
        missingDetail: "set APIFY_LINKEDIN_PROFILE_TASK_ID or APIFY_LINKEDIN_PROFILE_ACTOR_ID for employer/company research",
        fixGroup: "optional",
      }));
    }
  }

  return checks;
}

function buildRequiredEnvCheck(input: {
  env: EnvMap;
  name: string;
  label: string;
  severity: DoctorCheck["severity"];
  fixGroup: DoctorCheck["fixGroup"];
}): DoctorCheck {
  const ok = hasEnv(input.env, input.name);
  return {
    label: input.label,
    ok,
    severity: input.severity,
    detail: ok ? undefined : `missing ${input.name}`,
    envNames: [input.name],
    fixGroup: input.fixGroup,
  };
}

function buildAnyEnvCheck(input: {
  env: EnvMap;
  names: string[];
  label: string;
  severity: DoctorCheck["severity"];
  missingDetail: string;
  fixGroup: DoctorCheck["fixGroup"];
}): DoctorCheck {
  const ok = input.names.some((name) => hasEnv(input.env, name));
  return {
    label: input.label,
    ok,
    severity: input.severity,
    detail: ok ? undefined : input.missingDetail,
    envNames: input.names,
    fixGroup: input.fixGroup,
  };
}

function hasEnv(env: EnvMap, name: string) {
  const value = env[name];
  return typeof value === "string" && value.length > 0;
}

function envFlagEnabled(env: EnvMap, name: string, defaultValue: boolean) {
  const value = env[name];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value === "true";
}
