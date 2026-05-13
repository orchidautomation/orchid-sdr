#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

import { runTrellisAttioSmoke, runTrellisSmoke } from "../../gtm/src/index.js";
import { buildClaudeCodeMcpConfig, mergeClaudeCodeMcpConfig } from "./mcp-config.js";

let envLoadedForCwd = new Set<string>();

function loadProcessEnvFiles(input?: {
  cwd?: string;
  files?: string[];
}) {
  const cwd = input?.cwd ?? process.cwd();
  const files = input?.files ?? defaultEnvFiles();
  const cacheKey = `${cwd}::${files.join(",")}`;

  if (envLoadedForCwd.has(cacheKey)) {
    return;
  }

  for (const file of files) {
    const resolved = path.resolve(cwd, file);
    if (!existsSync(resolved)) {
      continue;
    }

    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(resolved);
      continue;
    }

    loadEnvFileFallback(resolved);
  }

  envLoadedForCwd.add(cacheKey);
}

function defaultEnvFiles() {
  const nodeEnv = process.env.NODE_ENV;
  return [
    ".env",
    ".env.local",
    ...(nodeEnv ? [`.env.${nodeEnv}`, `.env.${nodeEnv}.local`] : []),
  ];
}

function loadEnvFileFallback(filePath: string) {
  const source = readFileSync(filePath, "utf8");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const name = line.slice(0, separatorIndex).trim();
    if (!name || process.env[name] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[name] = value;
  }
}

loadProcessEnvFiles();

const [command, ...commandArgs] = process.argv.slice(2);
const parsedCliArgs = parseCliArgs(commandArgs);
const arg = parsedCliArgs.positionals[0];
const providerArg = parsedCliArgs.positionals[1];
const cliFlags = parsedCliArgs.flags;
const jsonOutput = isJsonOutput(cliFlags);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const trellisStateDirName = ".trellis";
const knowledgePackManifestName = "knowledge-pack.json";

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
  apify: {
    id: "apify",
    kind: "source",
    displayName: "Apify",
    requiredEnv: ["APIFY_TOKEN"],
    optionalEnv: ["APIFY_WEBHOOK_SECRET", "APIFY_BASE_URL", "APIFY_DATASET_LIMIT"],
    capabilities: ["signal.discovery", "webhooks.apify", "research.linkedinProfile"],
  },
  prospeo: {
    id: "prospeo",
    kind: "enrichment",
    displayName: "Prospeo",
    requiredEnv: ["PROSPEO_API_KEY"],
    optionalEnv: ["PROSPEO_BASE_URL"],
    capabilities: ["email.enrich", "research.enrich"],
  },
  langfuse: {
    id: "langfuse",
    kind: "observability",
    displayName: "Langfuse",
    requiredEnv: ["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"],
    optionalEnv: ["LANGFUSE_BASE_URL"],
    capabilities: ["trace.export", "evals.export"],
  },
  braintrust: {
    id: "braintrust",
    kind: "observability",
    displayName: "Braintrust",
    requiredEnv: ["BRAINTRUST_API_KEY", "BRAINTRUST_PROJECT_ID"],
    optionalEnv: ["BRAINTRUST_BASE_URL"],
    capabilities: ["trace.export", "evals.export"],
  },
} as const;

type V3ConnectionId = keyof typeof V3_CONNECTIONS;
const REQUIRED_V3_PROVIDER_IDS = ["attio", "agentmail", "firecrawl"] as const;
const OPTIONAL_V3_PROVIDER_IDS = ["apify", "prospeo", "langfuse", "braintrust"] as const;
type CloudflareSecretReadiness = {
  checked: boolean;
  ok: boolean;
  names: string[];
  error?: string;
};

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
  workflow: {
    binding: "PROSPECT_WORKFLOW";
    name: string | null;
    className: string | null;
    ready: boolean;
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
        rejectLegacyCommand("modules", "Use `trellis connect <provider>` and `trellis docs add <path>` in v3.");
        break;
      case "add":
        rejectLegacyCommand("add", "Use `trellis connect <provider>` or `trellis docs add <path>` in v3.");
        break;
      case "check":
        rejectLegacyCommand("check", "Use `trellis doctor` for the v3 reliability check.");
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
      case "verify":
        await handleVerifyCommand(arg, cliFlags);
        break;
      case "admin":
        rejectLegacyCommand("admin", "The v3 operator surface is the generated dashboard and MCP routes.");
        break;
      case "discovery":
        rejectLegacyCommand("discovery", "The v3 path ingests signals through Cloudflare webhooks and queues.");
        break;
      case "mcp":
        await handleMcpCommand(arg, cliFlags);
        break;
      case "init":
        if (cliFlags.legacy === true || typeof cliFlags.kit === "string") {
          rejectLegacyCommand("init --legacy/--kit", "Trellis init now emits the Cloudflare-first v3 scaffold only.");
        }
        await scaffoldV3Project(arg, cliFlags);
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
  npm run trellis -- smoke attio
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
  npm run trellis -- verify cloudflare --json
  npm run trellis -- verify cloudflare --live --url https://your-worker.workers.dev --exercise-agent
  npm run trellis -- verify cloudflare --live --url https://your-worker.workers.dev --attio-smoke --provider-smoke-token $TRELLIS_PROVIDER_SMOKE_TOKEN

Simple labels stay short in the CLI: attio, agentmail, firecrawl, apify, prospeo, langfuse, braintrust.

Init scaffolds the Trellis v3 GTM path by default.
Cloudflare is the default deploy target.
Business providers are connected after first boot.
Use --json when a plugin or coding agent is orchestrating the setup.`);
}

function rejectLegacyCommand(commandName: string, replacement: string): never {
  throw new Error(`trellis ${commandName} is old composition tooling and is not part of the v3 architecture. ${replacement}`);
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
  npm run trellis -- connect apify
  npm run trellis -- connect prospeo
  npm run trellis -- connect langfuse
  npm run trellis -- connect braintrust

Provider credentials can be connected after the first Cloudflare deploy.`);
    return;
  }

  const v3Connection = resolveV3Connection(moduleId, providerArg);
  if (v3Connection) {
    await printV3ConnectionGuide(v3Connection);
    return;
  }

  throw new Error(
    `Only curated v3 providers can be connected here. Use one of: ${Object.keys(V3_CONNECTIONS).join(", ")}.`,
  );
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

Cloudflare secrets:
${guide.requiredEnv.map((name) => `  - npx wrangler secret put ${name}`).join("\n")}

v3 behavior:
  - credentials are connected after the Cloudflare app boots
  - deployed agents read provider credentials from Cloudflare Worker secrets
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
  const remoteSecrets = loadCloudflareSecretReadiness();
  const aiGateway = readAiGatewayReadiness(process.cwd(), wranglerSource);
  const cloudflareResources = readCloudflareResourceConfig(wranglerConfigPath);
  const provisioning = buildCloudflareProvisioningPlan(cloudflareResources);
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
  const skillPack = await loadSkillPack(process.cwd());
  const providerReadiness = await loadAllV3ProviderReadiness({ remoteSecrets });
  const traceExport = readTraceExportReadiness();
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
    doctorCheck("cloudflare.aiGateway", aiGateway.ok, "warn", aiGateway.detail),
    doctorCheck("cloudflare.secrets", remoteSecrets.ok, "warn", remoteSecrets.ok
      ? `Wrangler can inspect ${remoteSecrets.names.length} deployed Worker secret(s)`
      : `Wrangler could not inspect deployed Worker secrets: ${remoteSecrets.error ?? "unknown error"}`),
    doctorCheck("knowledge.pack", knowledgePack.ok, "warn", knowledgePack.detail),
    doctorCheck("skills.pack", skillPack.ok, "warn", skillPack.detail),
    doctorCheck("observability.traceExport", true, "warn", traceExport.detail),
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
      traceExport: traceExport.summary,
      providers: Object.fromEntries(providerReadiness.map((provider) => [provider.id, provider.summary])),
      cloudflare: provisioning.summary,
      cloudflareSecrets: {
        checked: remoteSecrets.checked,
        ok: remoteSecrets.ok,
        names: remoteSecrets.names,
        error: remoteSecrets.error,
      },
      aiGateway: aiGateway.summary,
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

type VerifyCheckStatus = "pass" | "warn" | "fail" | "skip";

type VerifyCheck = {
  id: string;
  status: VerifyCheckStatus;
  detail: string;
  evidence?: unknown;
};

function verifyCheck(
  id: string,
  status: VerifyCheckStatus,
  detail: string,
  evidence?: unknown,
): VerifyCheck {
  return {
    id,
    status,
    detail,
    ...(evidence === undefined ? {} : { evidence }),
  };
}

function verifyGeneratedSourceChecks(strict: boolean): VerifyCheck[] {
  const agentPath = path.join(process.cwd(), "src", "agent.ts");
  const workerPath = path.join(process.cwd(), "src", "index.ts");
  const runtimePath = path.join(process.cwd(), "src", "trellis-runtime.ts");
  const agentSource = existsSync(agentPath) ? readFileSync(agentPath, "utf8") : "";
  const workerSource = existsSync(workerPath) ? readFileSync(workerPath, "utf8") : "";
  const runtimeSource = existsSync(runtimePath) ? readFileSync(runtimePath, "utf8") : "";

  return [
    verifyCheck("source.agent", agentSource.includes("trellis.agent(")
      && agentSource.includes("app.skill(")
      && !agentSource.includes("@flue/sdk")
      && !agentSource.includes("FlueContext")
      && !agentSource.includes("Cloudflare")
      ? "pass"
      : strict ? "fail" : "warn", agentSource
      ? "src/agent.ts is Trellis-first and hides Trellis Cloudflare imports"
      : "src/agent.ts not found"),
    verifyCheck("source.worker", workerSource.includes("trellis.cloudflare(agent)")
      && workerSource.includes("withTrellisRuntime(env")
      && workerSource.includes("runtime.worker.fetch")
      ? "pass"
      : strict ? "fail" : "warn", workerSource
      ? "src/index.ts wraps the hidden Cloudflare runtime"
      : "src/index.ts not found"),
    verifyCheck("source.runtimeAdapter", runtimeSource.includes("@flue/sdk/cloudflare")
      && runtimeSource.includes("getCloudflareAIBindingApiProvider")
      && runtimeSource.includes("getVirtualSandbox")
      && runtimeSource.includes("trellis_agent_sessions")
      && runtimeSource.includes("readPackFiles(input.packs, \"knowledge\")")
      && runtimeSource.includes("readPackFiles(input.packs, \"skills\")")
      ? "pass"
      : strict ? "fail" : "warn", runtimeSource
      ? "src/trellis-runtime.ts mounts R2 packs, Cloudflare AI, virtual sandbox, and D1 sessions"
      : "src/trellis-runtime.ts not found"),
  ];
}

async function verifyRemoteCloudflareRoutes(input: {
  endpoint: string;
  exerciseAgent: boolean;
  webhookToken?: string;
  attioSmoke: boolean;
  providerSmokeToken?: string;
}): Promise<VerifyCheck[]> {
  const checks: VerifyCheck[] = [];
  const health = await fetchVerifyJson(verifyRouteUrl(input.endpoint, "/healthz"));
  const healthBody = asCliRecord(health.body);
  checks.push(verifyCheck("remote.healthz", health.status === 200
    && healthBody?.ok === true
    && healthBody.stack === "trellis-v3-cloudflare"
    ? "pass"
    : "fail", health.status
    ? `/healthz returned ${health.status}`
    : `could not fetch /healthz: ${health.error ?? "unknown error"}`, summarizeRemoteEvidence(health)));

  const mcp = await fetchVerifyJson(verifyRouteUrl(input.endpoint, "/mcp/trellis"));
  const mcpBody = asCliRecord(mcp.body);
  const tools = Array.isArray(mcpBody?.tools) ? mcpBody.tools : [];
  checks.push(verifyCheck("remote.mcp", mcp.status === 200
    && mcpBody?.ok === true
    && tools.includes("trellis.health")
    ? "pass"
    : "fail", mcp.status
    ? `/mcp/trellis returned ${mcp.status}`
    : `could not fetch /mcp/trellis: ${mcp.error ?? "unknown error"}`, summarizeRemoteEvidence(mcp)));

  const smoke = await fetchVerifyJson(verifyRouteUrl(input.endpoint, "/smoke"));
  const smokeBody = asCliRecord(smoke.body);
  checks.push(verifyCheck("remote.smoke", smoke.status === 200
    && smokeBody?.ok === true
    && smokeBody.externalWrites === false
    ? "pass"
    : "fail", smoke.status
    ? `/smoke returned ${smoke.status}`
    : `could not fetch /smoke: ${smoke.error ?? "unknown error"}`, summarizeRemoteEvidence(smoke)));

  if (input.attioSmoke) {
    const headers: Record<string, string> = {};
    if (input.providerSmokeToken) {
      headers.authorization = `Bearer ${input.providerSmokeToken}`;
    }
    const attioSmoke = await fetchVerifyJson(verifyRouteUrl(input.endpoint, "/smoke/attio"), {
      method: "POST",
      headers,
    });
    const attioSmokeBody = asCliRecord(attioSmoke.body);
    checks.push(verifyCheck("remote.attioSmoke", attioSmoke.status === 200
      && attioSmokeBody?.ok === true
      && attioSmokeBody.externalWrites === true
      ? "pass"
      : "fail", attioSmoke.status
      ? `/smoke/attio returned ${attioSmoke.status}`
      : `could not fetch /smoke/attio: ${attioSmoke.error ?? "unknown error"}`, summarizeRemoteEvidence(attioSmoke)));
  } else {
    checks.push(verifyCheck("remote.attioSmoke", "skip", "Attio provider smoke skipped; pass --attio-smoke to perform a real CRM write"));
  }

  if (!input.exerciseAgent) {
    checks.push(verifyCheck("remote.webhook.agent", "skip", "live Trellis Cloudflare agent exercise skipped; pass --exercise-agent to post a safe signal webhook"));
    return checks;
  }

  const signalId = `sig_verify_${Date.now()}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (input.webhookToken) {
    headers.authorization = `Bearer ${input.webhookToken}`;
  }
  const webhook = await fetchVerifyJson(verifyRouteUrl(input.endpoint, "/webhooks/signals"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: signalId,
      workspaceId: "wrk_verify",
      threadId: `thr_${signalId}`,
      campaignId: "cmp_verify",
      provider: "trellis.verify",
      source: "verify.webhook",
      payload: {
        account: "Trellis Verify",
        signal: "Safe Cloudflare verification signal. Do not send.",
      },
    }),
  });
  const webhookBody = asCliRecord(webhook.body);
  const auditTypes = Array.isArray(webhookBody?.auditEvents)
    ? webhookBody.auditEvents.flatMap((event) => {
        const record = asCliRecord(event);
        return typeof record?.type === "string" ? [record.type] : [];
      })
    : [];
  checks.push(verifyCheck("remote.webhook.agent", webhook.status === 202
    && webhookBody?.ok === true
    && webhookBody.accepted === true
    && auditTypes.includes("skill.completed")
    ? "pass"
    : "fail", webhook.status === 401
    ? "safe signal webhook was rejected; pass --webhook-token or configure TRELLIS_WEBHOOK_SECRET locally"
    : webhook.status
      ? `/webhooks/signals returned ${webhook.status}; this is the live Trellis Cloudflare harness check and may use one model call`
      : `could not post /webhooks/signals: ${webhook.error ?? "unknown error"}`, summarizeRemoteEvidence(webhook)));

  const persistence = asCliRecord(webhookBody?.persistence);
  const providerRun = asCliRecord(webhookBody?.providerRun);
  const workflowDispatch = asCliRecord(webhookBody?.workflowDispatch);
  const queue = asCliRecord(webhookBody?.queue);
  const packs = asCliRecord(webhookBody?.packs);
  const knowledge = asCliRecord(packs?.knowledge);
  const skills = asCliRecord(packs?.skills);
  checks.push(verifyCheck("remote.webhook.persistence", webhook.status === 202
    && persistence?.enabled === true
    && providerRun?.enabled === true
    ? "pass"
    : "fail", "safe signal should persist D1 state and a provider-run record", {
    persistence,
    providerRun,
  }));
  checks.push(verifyCheck("remote.webhook.workflow", webhook.status === 202
    && workflowDispatch?.enabled === true
    && workflowDispatch.ok !== false
    && typeof workflowDispatch.instanceId === "string"
    ? "pass"
    : "fail", "safe signal should dispatch the configured Cloudflare Workflow", {
    workflowDispatch,
  }));
  checks.push(verifyCheck("remote.webhook.queue", webhook.status === 202
    && queue?.enabled === true
    && readCliNumber(queue.messages) >= 1
    ? "pass"
    : "fail", "safe signal should fan out at least one Cloudflare Queue event", {
    queue,
  }));
  checks.push(verifyCheck("remote.webhook.packs", webhook.status === 202
    && packs?.enabled === true
    && readCliNumber(knowledge?.objects) > 0
    && readCliNumber(skills?.objects) > 0
    ? "pass"
    : "fail", "safe signal should load R2-backed knowledge and skill packs", {
    packs,
  }));

  checks.push(verifyCheck("remote.webhook.safety", webhook.status === 202
    && webhookBody?.noSendsMode === true
    ? "pass"
    : "fail", "safe live verification requires no-send mode before approval/replay checks", {
    noSendsMode: webhookBody?.noSendsMode,
  }));

  if (webhook.status === 202 && workflowDispatch?.enabled === true && typeof workflowDispatch.instanceId === "string") {
    const workflowReplay = await fetchVerifyJson(verifyRouteUrl(input.endpoint, `/operator/workflows/${encodeURIComponent(workflowDispatch.instanceId)}/replay`), {
      method: "POST",
      headers,
      body: JSON.stringify({
        actor: "trellis.verify",
        reason: "live Cloudflare verifier workflow replay check",
        replayId: `${workflowDispatch.instanceId}_verify_replay`,
      }),
    });
    const workflowReplayBody = asCliRecord(workflowReplay.body);
    const workflowReplayPersistence = asCliRecord(workflowReplayBody?.persistence);
    checks.push(verifyCheck("remote.operator.workflowReplay", workflowReplay.status === 200
      && workflowReplayBody?.ok === true
      && workflowReplayPersistence?.enabled === true
      ? "pass"
      : "fail", "operator workflow replay should redispatch a stored Cloudflare Workflow run", summarizeRemoteEvidence(workflowReplay)));
  } else {
    checks.push(verifyCheck("remote.operator.workflowReplay", "fail", "workflow replay requires a dispatched workflow instance id", {
      workflowDispatch,
    }));
  }

  const approval = readVerifyApproval(webhookBody, "email.send");
  if (webhook.status === 202 && webhookBody?.noSendsMode === true && approval) {
    const approvalResponse = await fetchVerifyJson(verifyRouteUrl(input.endpoint, `/approvals/${encodeURIComponent(approval.id)}/approve`), {
      method: "POST",
      headers,
      body: JSON.stringify({
        signalId: approval.signalId,
        draftId: approval.draftId,
        action: approval.action,
        actor: "trellis.verify",
        reason: "live Cloudflare verifier provider-action replay check",
      }),
    });
    const approvalBody = asCliRecord(approvalResponse.body);
    const providerAction = asCliRecord(approvalBody?.providerAction);
    const providerActionId = typeof providerAction?.id === "string" ? providerAction.id : undefined;
    checks.push(verifyCheck("remote.operator.approvalGate", approvalResponse.status === 200
      && approvalBody?.ok === true
      && providerActionId
      && providerAction?.status === "blocked_no_send"
      ? "pass"
      : "fail", "approval should create a no-send-blocked provider action intent", summarizeRemoteEvidence(approvalResponse)));

    if (providerActionId) {
      const providerReplay = await fetchVerifyJson(verifyRouteUrl(input.endpoint, `/operator/provider-actions/${encodeURIComponent(providerActionId)}/replay`), {
        method: "POST",
        headers,
        body: JSON.stringify({
          actor: "trellis.verify",
          reason: "live Cloudflare verifier provider-action requeue check",
        }),
      });
      const providerReplayBody = asCliRecord(providerReplay.body);
      const replayedAction = asCliRecord(providerReplayBody?.providerAction);
      const replayQueue = asCliRecord(providerReplayBody?.queue);
      checks.push(verifyCheck("remote.operator.providerActionReplay", providerReplay.status === 200
        && providerReplayBody?.ok === true
        && replayedAction?.status === "queued"
        && replayQueue?.enabled === true
        ? "pass"
        : "fail", "operator provider-action replay should requeue a no-send-safe provider action", summarizeRemoteEvidence(providerReplay)));
    } else {
      checks.push(verifyCheck("remote.operator.providerActionReplay", "fail", "provider-action replay requires an approval-created provider action id", summarizeRemoteEvidence(approvalResponse)));
    }
  } else {
    checks.push(verifyCheck("remote.operator.approvalGate", "fail", "approval gate replay check requires no-send mode and an email.send approval", {
      noSendsMode: webhookBody?.noSendsMode,
      approval,
    }));
    checks.push(verifyCheck("remote.operator.providerActionReplay", "fail", "provider-action replay requires a no-send-blocked provider action"));
  }

  const mcpAfterWebhook = await fetchVerifyJson(verifyRouteUrl(input.endpoint, "/mcp/trellis"));
  const mcpAfterWebhookBody = asCliRecord(mcpAfterWebhook.body);
  const snapshot = asCliRecord(mcpAfterWebhookBody?.snapshot);
  const counts = asCliRecord(snapshot?.counts);
  checks.push(verifyCheck("remote.state.snapshot", mcpAfterWebhook.status === 200
    && mcpAfterWebhookBody?.ok === true
    && readCliNumber(counts?.signals) >= 1
    && readCliNumber(counts?.providerRuns) >= 1
    && readCliNumber(counts?.workflowRuns) >= 1
    && readCliNumber(counts?.approvals) >= 1
    && readCliNumber(counts?.providerActions) >= 1
    ? "pass"
    : "fail", "MCP snapshot should expose persisted signal, provider-run, workflow, approval, and provider-action state after the live exercise", {
    counts,
    response: summarizeRemoteEvidence(mcpAfterWebhook),
  }));

  return checks;
}

function readVerifyApproval(webhookBody: Record<string, unknown> | undefined, action: string) {
  const approvals = Array.isArray(webhookBody?.approvals) ? webhookBody.approvals : [];
  for (const value of approvals) {
    const approval = asCliRecord(value);
    if (approval?.action !== action || typeof approval.id !== "string") {
      continue;
    }
    return {
      id: approval.id,
      action,
      signalId: typeof approval.signalId === "string" ? approval.signalId : undefined,
      draftId: typeof approval.draftId === "string" ? approval.draftId : undefined,
    };
  }
  return null;
}

async function fetchVerifyJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      body: parseJsonText(text),
      text: text.slice(0, 1_000),
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      body: null,
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeRemoteEvidence(result: Awaited<ReturnType<typeof fetchVerifyJson>>) {
  const body = asCliRecord(result.body);
  return {
    status: result.status,
    ok: result.ok,
    bodyOk: body?.ok ?? null,
    text: result.ok ? undefined : result.text,
    error: "error" in result ? result.error : undefined,
  };
}

function verifyRouteUrl(endpoint: string, route: string) {
  return new URL(route, endpoint).href;
}

function normalizeVerifyUrl(value: string | undefined) {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch {
    throw new Error(`Invalid Cloudflare verify URL: ${value}`);
  }
}

function isLocalVerifyEndpoint(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function asCliRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : undefined;
}

function readCliNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseJsonText(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function sanitizeCommandResult(result: ReturnType<typeof runCommand> | null) {
  if (!result) {
    return null;
  }
  return {
    command: result.command,
    args: result.args,
    status: result.status,
    signal: result.signal,
    error: result.error,
    stderr: result.status === 0 ? undefined : result.stderr,
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

async function loadAllV3ProviderReadiness(input?: {
  remoteSecrets?: CloudflareSecretReadiness;
}) {
  const required = await Promise.all(REQUIRED_V3_PROVIDER_IDS.map((id) => loadV3ProviderReadiness(id, input)));
  const optional = await Promise.all(
    OPTIONAL_V3_PROVIDER_IDS
      .filter((id) => existsSync(path.join(process.cwd(), trellisStateDirName, "providers", `${id}.json`)))
      .map((id) => loadV3ProviderReadiness(id, input)),
  );
  return [...required, ...optional];
}

function readTraceExportReadiness() {
  const generic = Boolean(process.env.TRELLIS_TRACE_EXPORT_URL);
  const langfuseMissing = V3_CONNECTIONS.langfuse.requiredEnv.filter((name) => !process.env[name]);
  const braintrustMissing = V3_CONNECTIONS.braintrust.requiredEnv.filter((name) => !process.env[name]);
  const langfuse = langfuseMissing.length === 0;
  const braintrust = braintrustMissing.length === 0;
  const enabled = generic || langfuse || braintrust;
  return {
    detail: enabled
      ? "external trace export configured; D1 trace events remain canonical"
      : "D1 trace events enabled; optional external trace export not configured",
    summary: {
      enabled,
      canonical: "trellis_trace_events",
      generic,
      langfuse,
      braintrust,
      missingEnv: {
        langfuse: langfuseMissing,
        braintrust: braintrustMissing,
      },
    },
  };
}

function readAiGatewayReadiness(cwd: string, wranglerSource: string) {
  const runtimePath = path.join(cwd, "src", "trellis-runtime.ts");
  const envExamplePath = path.join(cwd, ".env.example");
  const runtimeSource = existsSync(runtimePath) ? readFileSync(runtimePath, "utf8") : "";
  const envExample = existsSync(envExamplePath) ? readFileSync(envExamplePath, "utf8") : "";
  const hasAiBinding = /\bAI\b/.test(wranglerSource);
  const hasGatewayRegistration = runtimeSource.includes("getCloudflareAIBindingApiProvider")
    && runtimeSource.includes("gateway:")
    && runtimeSource.includes("TRELLIS_AI_GATEWAY_ID");
  const envDocumented = envExample.includes("TRELLIS_AI_GATEWAY_ID");
  const ok = hasAiBinding && hasGatewayRegistration && envDocumented;
  return {
    ok,
    detail: ok
      ? "Cloudflare AI binding routes through the generated Trellis AI Gateway id"
      : "Cloudflare AI Gateway needs AI binding plus TRELLIS_AI_GATEWAY_ID in the generated Trellis runtime adapter",
    summary: {
      enabled: ok,
      binding: hasAiBinding ? "AI" : null,
      gatewayId: process.env.TRELLIS_AI_GATEWAY_ID ?? "default",
      adapter: hasGatewayRegistration,
      envDocumented,
    },
  };
}

function readConfiguredProviderIds(cwd: string): V3ConnectionId[] {
  const agentPath = path.join(cwd, "src", "agent.ts");
  const source = existsSync(agentPath) ? readFileSync(agentPath, "utf8") : "";
  return (Object.keys(V3_CONNECTIONS) as V3ConnectionId[])
    .filter((id) => new RegExp(`\\b${id}\\s*\\(`).test(source));
}

async function loadV3ProviderReadiness(
  id: V3ConnectionId,
  input?: {
    remoteSecrets?: CloudflareSecretReadiness;
  },
) {
  const guide = V3_CONNECTIONS[id];
  const manifestPath = path.join(process.cwd(), trellisStateDirName, "providers", `${id}.json`);
  const manifestExists = existsSync(manifestPath);
  const missingRequiredEnv = guide.requiredEnv.filter((name) => !process.env[name]);
  const remoteSecrets = input?.remoteSecrets;
  const missingRemoteSecrets = remoteSecrets?.ok
    ? guide.requiredEnv.filter((name) => !remoteSecrets.names.includes(name))
    : guide.requiredEnv;
  const remoteReady = Boolean(remoteSecrets?.ok) && missingRemoteSecrets.length === 0;
  const ready = manifestExists && missingRequiredEnv.length === 0 && remoteReady;
  return {
    id,
    ok: ready,
    detail: ready
      ? `${guide.displayName} connected and required local/deployed env is present`
      : manifestExists
        ? `${guide.displayName} connected; missing local env: ${formatMissingList(missingRequiredEnv)}; missing Cloudflare secrets: ${formatMissingList(missingRemoteSecrets)}`
        : `${guide.displayName} not connected yet; run trellis connect ${id}`,
    summary: {
      connected: manifestExists,
      manifestPath: manifestExists ? manifestPath : null,
      status: ready ? "ready" : (manifestExists ? "waiting_for_env" : "not_connected"),
      missingRequiredEnv,
      remoteSecretsChecked: Boolean(remoteSecrets?.checked),
      missingRemoteSecrets,
      capabilities: guide.capabilities,
    },
  };
}

function formatMissingList(values: readonly string[]) {
  return values.length > 0 ? values.join(", ") : "none";
}

function loadCloudflareSecretReadiness(): CloudflareSecretReadiness {
  const result = runCommand("npx", ["wrangler", "secret", "list", "--format", "json"], { stdio: "pipe" });
  if (result.status !== 0) {
    return {
      checked: true,
      ok: false,
      names: [],
      error: result.stderr ?? result.error ?? "wrangler secret list failed",
    };
  }
  const parsed = parseJsonText(result.stdout ?? "[]");
  if (!Array.isArray(parsed)) {
    return {
      checked: true,
      ok: false,
      names: [],
      error: "wrangler secret list returned unexpected output",
    };
  }
  return {
    checked: true,
    ok: true,
    names: parsed.flatMap((item) => {
      const record = asCliRecord(item);
      return typeof record?.name === "string" ? [record.name] : [];
    }).sort((left, right) => left.localeCompare(right)),
  };
}

async function loadKnowledgePackManifest(cwd: string) {
  const manifestPath = path.join(cwd, trellisStateDirName, knowledgePackManifestName);
  if (!existsSync(manifestPath)) {
    const fallbackKnowledgeDir = path.join(cwd, "knowledge");
    const fallbackFiles = existsSync(fallbackKnowledgeDir)
      ? await collectMarkdownFiles(fallbackKnowledgeDir)
      : [];
    return {
      ok: fallbackFiles.length > 0,
      detail: fallbackFiles.length > 0
        ? `knowledge directory has ${fallbackFiles.length} markdown file(s); deploy will auto-pack it`
        : existsSync(fallbackKnowledgeDir)
          ? "knowledge directory exists but no markdown files were found"
        : "no knowledge pack manifest or knowledge directory found",
      summary: fallbackFiles.length > 0
        ? {
            manifestPath: null,
            source: "knowledge",
            target: "r2://TRELLIS_PACKS/knowledge",
            files: fallbackFiles.length,
            missingFiles: [],
            generated: true,
          }
        : null,
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
    const fallbackKnowledgeDir = path.join(cwd, "knowledge");
    if (!existsSync(fallbackKnowledgeDir)) {
      return null;
    }
    const files = await collectMarkdownFiles(fallbackKnowledgeDir);
    if (files.length === 0) {
      return null;
    }
    return {
      manifestPath: null,
      source: "knowledge",
      files: await Promise.all(files.map(async (filePath) => {
        const contents = await readFile(filePath);
        return {
          path: toPosixPath(path.relative(cwd, filePath)),
          bytes: contents.byteLength,
          sha256: createHash("sha256").update(contents).digest("hex"),
        };
      })),
      generated: true,
    };
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
  if (resolvedScope === "attio") {
    const result = await runTrellisAttioSmoke({ env: process.env });
    if (!result.ok) {
      process.exitCode = 1;
    }
    if (jsonOutput) {
      emitJson({
        ...result,
        command: "smoke",
        scope: resolvedScope,
      });
      return;
    }

    console.log(`Trellis Attio provider smoke:

Mode:
  - ${result.mode}
  - external writes: ${result.externalWrites ? "enabled" : "blocked"}

Checks:`);
    for (const check of result.checks) {
      console.log(`  - ${check.status}: ${check.id} - ${check.detail}`);
    }
    if (result.error) {
      console.log(`
Error:
  - ${result.error}`);
    }
    return;
  }

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
  if (resolvedTarget !== "cloudflare") {
    throw new Error(
      `Deploy target "${resolvedTarget}" is old architecture. Trellis v3 deploys to Cloudflare only.`,
    );
  }

  await handleCloudflareDeploy(flags);
}

async function handleVerifyCommand(target: string | undefined, flags: Record<string, string | boolean>) {
  const resolvedTarget = (target ?? "cloudflare").toLowerCase();
  if (resolvedTarget !== "cloudflare") {
    throw new Error(`Verify target "${resolvedTarget}" is not supported in v3. Use: trellis verify cloudflare`);
  }

  await handleCloudflareVerify(flags);
}

async function handleCloudflareVerify(flags: Record<string, string | boolean>) {
  const wranglerConfigPath = findWranglerConfig(process.cwd());
  const wranglerSource = wranglerConfigPath ? readFileSync(wranglerConfigPath, "utf8") : "";
  const aiGateway = readAiGatewayReadiness(process.cwd(), wranglerSource);
  const cloudflareResources = readCloudflareResourceConfig(wranglerConfigPath);
  const provisioning = buildCloudflareProvisioningPlan(cloudflareResources);
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
  const skillPack = await loadSkillPack(process.cwd());
  const packSync = await buildCloudflarePackSyncPlan(process.cwd(), wranglerConfigPath);
  const smoke = await runTrellisSmoke();
  const endpoint = normalizeVerifyUrl(readFlagString(flags, ["url", "endpoint", "origin"]) ?? process.env.TRELLIS_VERIFY_URL);
  const live = flags.live === true || Boolean(endpoint);
  const auditRemoteSecrets = live && !isLocalVerifyEndpoint(endpoint);
  const remoteSecrets = auditRemoteSecrets ? loadCloudflareSecretReadiness() : {
    checked: false,
    ok: false,
    names: [],
  };
  const providerReadiness = await loadAllV3ProviderReadiness({ remoteSecrets });
  const configuredProviders = readConfiguredProviderIds(process.cwd());
  const exerciseAgent = flags["exercise-agent"] === true || flags.signal === true;
  const webhookToken = readFlagString(flags, ["webhook-token", "token"]) ?? process.env.TRELLIS_WEBHOOK_SECRET ?? process.env.SIGNAL_WEBHOOK_SECRET;
  const attioSmoke = flags["attio-smoke"] === true || flags["provider-smoke"] === true;
  const providerSmokeToken = readFlagString(flags, ["provider-smoke-token", "smoke-token"])
    ?? process.env.TRELLIS_PROVIDER_SMOKE_TOKEN;
  const checks: VerifyCheck[] = [
    ...verifyGeneratedSourceChecks(Boolean(wranglerConfigPath)),
    verifyCheck("cloudflare.config", wranglerConfigPath ? "pass" : "warn", wranglerConfigPath
      ? `found ${path.basename(wranglerConfigPath)}`
      : "no Wrangler config found in this directory"),
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
      verifyCheck(`binding.${binding}`, wranglerSource.includes(binding) ? "pass" : "warn", `${binding} binding ${wranglerSource.includes(binding) ? "declared" : "not declared"}`),
    ),
    ...provisioning.summary.resources.map((resource) =>
      verifyCheck(`cloudflare.${resource.id}`, resource.ready ? "pass" : "warn", resource.detail),
    ),
    verifyCheck("cloudflare.aiGateway", aiGateway.ok ? "pass" : "warn", aiGateway.detail, aiGateway.summary),
    auditRemoteSecrets
      ? verifyCheck("cloudflare.secrets", remoteSecrets.ok ? "pass" : "fail", remoteSecrets.ok
        ? `Wrangler can inspect ${remoteSecrets.names.length} deployed Worker secret(s)`
        : `Wrangler could not inspect deployed Worker secrets: ${remoteSecrets.error ?? "unknown error"}`, {
        names: remoteSecrets.names,
        error: remoteSecrets.error,
      })
      : verifyCheck("cloudflare.secrets", "skip", endpoint && isLocalVerifyEndpoint(endpoint)
        ? "deployed Worker secret audit skipped for local verify endpoint"
        : "deployed Worker secret audit skipped; pass --live with the deployed Worker URL"),
    ...providerReadiness
      .filter((provider) => configuredProviders.includes(provider.id))
      .map((provider) => {
        const missingRemoteSecrets = Array.isArray(provider.summary.missingRemoteSecrets)
          ? provider.summary.missingRemoteSecrets
          : [];
        const failWhenMissing = auditRemoteSecrets
          && (exerciseAgent && provider.id === "firecrawl" || attioSmoke && provider.id === "attio");
        return verifyCheck(`provider.${provider.id}.secrets`, missingRemoteSecrets.length === 0 ? "pass" : (failWhenMissing ? "fail" : "warn"), missingRemoteSecrets.length === 0
          ? `${provider.id} deployed Worker secret(s) present`
          : `${provider.id} is configured but missing deployed Worker secret(s): ${missingRemoteSecrets.join(", ")}`, provider.summary);
      }),
    verifyCheck("cloudflare.autoProvisionable", provisioning.summary.autoProvisionable ? "pass" : "warn", provisioning.summary.autoProvisionable
      ? "Trellis can resolve/create first-run Cloudflare resources from this Wrangler config"
      : "Wrangler config is missing one or more resources Trellis needs before apply"),
    verifyCheck("packSync.plan", packSync.summary.syncable ? "pass" : "warn", packSync.summary.syncable
      ? `pack sync has ${packSync.summary.entries.length} R2 object(s) for ${packSync.summary.bucketName}`
      : "pack sync needs a TRELLIS_PACKS bucket_name and at least one knowledge or skill file"),
    verifyCheck("knowledge.pack", knowledgePack.ok ? "pass" : "warn", knowledgePack.detail),
    verifyCheck("skills.pack", skillPack.ok ? "pass" : "warn", skillPack.detail),
    verifyCheck("smoke.local", smoke.ok ? "pass" : "fail", smoke.ok
      ? "safe local fixture workflow passed"
      : "safe local fixture workflow failed"),
  ];

  const wranglerAuth = live
    ? runCommand("npx", ["wrangler", "whoami"], { stdio: "pipe" })
    : null;
  checks.push(live
    ? verifyCheck("wrangler.auth", wranglerAuth?.status === 0 ? "pass" : "fail", wranglerAuth?.status === 0
      ? "Wrangler authenticated successfully"
      : "Wrangler auth failed; run wrangler login or set CLOUDFLARE_API_TOKEN")
    : verifyCheck("wrangler.auth", "skip", "live Wrangler auth check skipped; pass --live to verify account access"));

  if (endpoint) {
    checks.push(...await verifyRemoteCloudflareRoutes({
      endpoint,
      exerciseAgent,
      webhookToken,
      attioSmoke,
      providerSmokeToken,
    }));
  } else {
    checks.push(verifyCheck("remote.healthz", "skip", "deployed route checks skipped; pass --url https://<worker>"));
    checks.push(verifyCheck("remote.mcp", "skip", "deployed route checks skipped; pass --url https://<worker>"));
    checks.push(verifyCheck("remote.smoke", "skip", "deployed route checks skipped; pass --url https://<worker>"));
    checks.push(verifyCheck("remote.attioSmoke", "skip", "Attio provider smoke skipped; pass --url and --attio-smoke"));
    checks.push(verifyCheck("remote.webhook.agent", "skip", "live Trellis Cloudflare agent exercise skipped; pass --url and --exercise-agent"));
  }

  const ok = checks.every((check) => check.status !== "fail");
  const result = {
    ok,
    command: "verify",
    target: "cloudflare",
    mode: live ? "live" : "local",
    live,
    endpoint,
    exerciseAgent,
    attioSmoke,
    checks,
    smoke: {
      ok: smoke.ok,
      fixture: smoke.fixture.id,
      auditEvents: smoke.auditEvents.map((event) => event.type),
    },
    cloudflare: provisioning.summary,
    aiGateway: aiGateway.summary,
    packSync: packSync.summary,
    knowledgePack: knowledgePack.summary,
    skillPack: skillPack.summary,
    providers: Object.fromEntries(providerReadiness.map((provider) => [provider.id, provider.summary])),
    cloudflareSecrets: {
      checked: remoteSecrets.checked,
      ok: remoteSecrets.ok,
      names: remoteSecrets.names,
      error: remoteSecrets.error,
    },
    wranglerAuth: sanitizeCommandResult(wranglerAuth),
    next: live
      ? [
          "inspect failed checks before connecting live providers",
          "run trellis connect attio / agentmail / firecrawl after first boot is green",
        ]
      : [
          "trellis deploy",
          "trellis verify cloudflare --live --url https://<worker>",
          "trellis verify cloudflare --live --url https://<worker> --exercise-agent",
        ],
  };

  if (jsonOutput) {
    emitJson(result);
  } else {
    console.log(`Trellis Cloudflare verification (${result.mode}):`);
    for (const check of checks) {
      console.log(`  - ${check.status}: ${check.id} - ${check.detail}`);
    }
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

async function handleCloudflareDeploy(flags: Record<string, string | boolean>) {
  const wranglerConfigPath = findWranglerConfig(process.cwd());
  const wranglerSource = wranglerConfigPath ? readFileSync(wranglerConfigPath, "utf8") : "";
  const aiGateway = readAiGatewayReadiness(process.cwd(), wranglerSource);
  const cloudflareResources = readCloudflareResourceConfig(wranglerConfigPath);
  const provisioning = buildCloudflareProvisioningPlan(cloudflareResources);
  const knowledgePack = await loadKnowledgePackManifest(process.cwd());
  const skillPack = await loadSkillPack(process.cwd());
  const providerReadiness = await loadAllV3ProviderReadiness();
  const traceExport = readTraceExportReadiness();
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
      "D1 trace events and optional trace export",
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
    aiGateway: aiGateway.summary,
    packSync: packSync.summary,
    traceExport: traceExport.summary,
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
  - D1 trace events and optional trace export
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
  const workflowBinding = config.workflows.find((workflow) => workflow.binding === "PROSPECT_WORKFLOW");
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
  const workflow = {
    binding: "PROSPECT_WORKFLOW" as const,
    name: workflowBinding?.name ?? null,
    className: workflowBinding?.className ?? null,
    ready: Boolean(workflowBinding?.name && workflowBinding.className),
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
    {
      id: "workflow.prospect",
      ready: workflow.ready,
      detail: workflow.ready
        ? `PROSPECT_WORKFLOW is ${workflow.name} using ${workflow.className}`
        : "PROSPECT_WORKFLOW needs name and class_name in Wrangler config",
      commands: [],
    },
  ];
  const configured = Boolean(config.configPath);
  const autoProvisionable = configured
    && Boolean(d1?.databaseName)
    && (d1Ready || d1AutoResolvable)
    && r2Buckets.every((bucket) => bucket.ready)
    && queue.ready
    && workflow.ready;

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
    workflow,
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
      alreadyExistsPattern: /already exists|already taken|queue with this name/i,
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
      alreadyExistsPattern: /already exists|already taken|queue with this name/i,
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
    if (knowledgeManifest.manifestPath) {
      const manifestContents = await readFile(knowledgeManifest.manifestPath);
      entries.push({
        scope: "knowledge",
        filePath: knowledgeManifest.manifestPath,
        objectKey: "knowledge/manifest.json",
        bytes: manifestContents.byteLength,
        sha256: createHash("sha256").update(manifestContents).digest("hex"),
      });
    }
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
      "--remote",
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
  await mkdir(path.join(targetDir, "src", "crm"), { recursive: true });
  await mkdir(path.join(targetDir, "src", "state"), { recursive: true });
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
  await writeFile(path.join(targetDir, "src", "trellis-runtime.ts"), renderV3RuntimeSource());
  await writeFile(path.join(targetDir, "src", "crm", "attio.map.ts"), renderV3AttioMapSource());
  await writeFile(path.join(targetDir, "src", "state", "prospect.map.ts"), renderV3ProspectStateMapSource());
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
    "npm run cf:login",
    "npm run deploy",
    "npm run smoke",
    "npm run verify",
    "npm run trellis -- connect attio",
    "npm run trellis -- connect agentmail",
    "npm run trellis -- connect firecrawl",
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
        "src/trellis-runtime.ts",
        "src/crm/attio.map.ts",
        "src/state/prospect.map.ts",
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
      trellis: "trellis",
      doctor: "trellis doctor",
      "docs:add": "trellis docs add ./knowledge",
      deploy: "trellis deploy",
      smoke: "trellis smoke",
      verify: "trellis verify cloudflare",
      typecheck: "tsc --noEmit",
      "cf:login": "wrangler login",
      "cf:deploy": "wrangler deploy",
      "cf:tail": "wrangler tail",
    },
    dependencies: {
      "@flue/sdk": "^0.5.3",
      "@trellis/gtm": resolveScaffoldDependency("gtm", "0.1.0"),
      "@trellis/providers": resolveScaffoldDependency("providers", "0.1.0"),
      zod: "^3.25.76",
    },
    devDependencies: {
      "@cloudflare/workers-types": "^4.20260511.1",
      "@trellis/cli": resolveScaffoldDependency("trellis-cli", "0.1.0"),
      tsx: "^4.20.6",
      typescript: "^5.8.3",
      wrangler: "^4.90.0",
    },
    // The current runtime dependency pulls pi-ai, which currently resolves a compromised Mistral SDK.
    // Trellis' generated path uses the Cloudflare AI binding, so keep Mistral disabled
    // until upstream runtime ship a clean upstream dependency.
    overrides: {
      "@mistralai/mistralai": "npm:no-op@1.0.3",
    },
  };
}

function resolveScaffoldDependency(packageDirName: string, fallbackVersion: string) {
  const packageDir = path.join(repoRoot, "packages", packageDirName);
  if (!existsSync(path.join(packageDir, "package.json"))) {
    return fallbackVersion;
  }
  return pathToFileURL(packageDir).href;
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
TRELLIS_PROVIDER_SMOKE_TOKEN=
TRELLIS_ATTIO_SMOKE_DOMAIN=
TRELLIS_ATTIO_SMOKE_EMAIL=
AGENTMAIL_API_KEY=
AGENTMAIL_WEBHOOK_SECRET=
FIRECRAWL_API_KEY=
APIFY_TOKEN=
APIFY_WEBHOOK_SECRET=
APIFY_BASE_URL=
APIFY_DATASET_LIMIT=
PROSPEO_API_KEY=
PROSPEO_BASE_URL=
HANDOFF_WEBHOOK_URL=
HANDOFF_WEBHOOK_SECRET=

# Optional model override for Trellis-backed skills.
# The default uses Cloudflare Workers AI through Cloudflare's default AI Gateway.
TRELLIS_MODEL=
TRELLIS_AI_GATEWAY_ID=default
TRELLIS_FOLLOW_UP_DELAY=3 days

# Optional trace export. D1 trace events, Cloudflare logs, and AI Gateway remain the default.
TRELLIS_TRACE_EXPORT_URL=
TRELLIS_TRACE_EXPORT_TOKEN=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=
BRAINTRUST_API_KEY=
BRAINTRUST_PROJECT_ID=
BRAINTRUST_BASE_URL=
`;
}

function renderV3AgentSource() {
  return `import { trellis, schema } from "@trellis/gtm";
import { agentmail, attio, firecrawl } from "@trellis/providers";
import attioMap from "./crm/attio.map";
import stateMap from "./state/prospect.map";

export default trellis.agent("sdr", {
  crm: attio({ map: attioMap }),
  email: agentmail(),
  research: firecrawl(),
  model: "anthropic/claude-sonnet-4.6",
  state: stateMap,
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

function renderV3ProspectStateMapSource() {
  return `import { trellis } from "@trellis/gtm";

const stateMap = trellis.state({
  tables: {
    prospects: {
      primaryKey: "id",
      fields: {
        id: "prospect.id",
        signalId: "signal.id",
        company: "signal.payload.company",
        domain: "signal.payload.domain",
        status: "qualification.decision",
        summary: "qualification.summary",
        confidence: { source: "qualification.confidence", type: "number" },
        nextStep: "qualification.nextStep",
        researchSummary: "research.summary",
        draftSubject: "draft.subject",
      },
      indexes: [
        { name: "prospects_by_domain", fields: ["domain"] },
        { name: "prospects_by_status", fields: ["status"] },
      ],
      relationships: {
        signal: { table: "signals", local: "signalId", foreign: "id" },
      },
    },
    signals: {
      primaryKey: "id",
      fields: {
        id: "signal.id",
        source: "signal.source",
        provider: "signal.provider",
        payload: { source: "signal.payload", type: "json" },
      },
    },
  },
});

export default stateMap;
`;
}

function renderV3AttioMapSource() {
  return `import type { TrellisAttioMap } from "@trellis/gtm";

const attioMap = {
  companies: {
    name: "company",
    domains: "domain",

    // Example custom Attio attributes. Rename these keys to match your
    // Attio attribute API slugs, then point each one at Trellis context.
    // icp_status: "qualification.decision",
    // qualification_summary: "qualification.summary",
    // latest_signal: "signal.payload.signal",
  },
  people: {
    name: "fullName",
    email_addresses: "email",
    job_title: "title",
    linkedin: "linkedinUrl",

    // buying_role: "qualification.persona",
  },
} satisfies TrellisAttioMap;

export default attioMap;
`;
}

function renderV3WorkerSource() {
  return `import { DurableObject, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { trellis } from "@trellis/gtm";
import agent from "./agent";
import { withTrellisRuntime } from "./trellis-runtime";

const runtime = trellis.cloudflare(agent);
const RuntimeTrellisAgent = runtime.TrellisAgent;
const RuntimeProspectWorkflow = runtime.ProspectWorkflow;

export class TrellisAgent extends DurableObject<Record<string, unknown>> {
  async fetch(request: Request) {
    return new RuntimeTrellisAgent(this.ctx, this.env).fetch(request);
  }
}

export class ProspectWorkflow extends WorkflowEntrypoint<Record<string, unknown>, Record<string, unknown>> {
  async run(event: Readonly<WorkflowEvent<Record<string, unknown>>>, step: WorkflowStep) {
    return new RuntimeProspectWorkflow(this.env).run(event, step);
  }
}

export default {
  fetch(request: Request, env: Record<string, unknown>) {
    return runtime.worker.fetch(request, withTrellisRuntime(env, request));
  },
  queue(batch: MessageBatch<unknown>, env: Record<string, unknown>) {
    return runtime.worker.queue?.(batch as never, withTrellisRuntime(env));
  },
};
`;
}

function renderV3RuntimeSource() {
  return `import { registerApiProvider, registerProvider } from "@flue/sdk/app";
import { createFlueContext, type SessionData, type SessionEnv, type SessionStore } from "@flue/sdk/client";
import { getCloudflareAIBindingApiProvider, getVirtualSandbox } from "@flue/sdk/cloudflare";
import { resolveModel } from "@flue/sdk/internal";
import { bashFactoryToSessionEnv } from "@flue/sdk/sandbox";
import type { TrellisRuntimeContextFactoryInput } from "@trellis/gtm";

type TrellisEnv = Record<string, unknown> & {
  TRELLIS_DB?: D1Database;
  TRELLIS_AI_GATEWAY_ID?: string;
  AI?: unknown;
};

type PackFile = {
  path: string;
  text: string;
};

export function withTrellisRuntime(env: Record<string, unknown>, request?: Request) {
  return {
    ...env,
    TRELLIS_RUNTIME_CWD: "/workspace",
    TRELLIS_RUNTIME_CONTEXT_FACTORY: (input: TrellisRuntimeContextFactoryInput) =>
      createTrellisRuntimeContext(input, request),
  };
}

async function createTrellisRuntimeContext(
  input: TrellisRuntimeContextFactoryInput,
  request?: Request,
) {
  const env = (input.env ?? {}) as TrellisEnv;
  registerApiProvider(getCloudflareAIBindingApiProvider());
  if (env.AI) {
    registerProvider("cloudflare", {
      api: "cloudflare-ai-binding",
      binding: createTrellisAiBinding(env.AI),
      gateway: { id: readAiGatewayId(env) },
    } as never);
  }

  const sandbox = await getVirtualSandbox();
  await preloadTrellisPacks(sandbox, input);

  return createFlueContext({
    id: stableAgentId(input),
    runId: stableRunId(input),
    payload: input.signal.payload ?? {},
    env,
    req: request,
    agentConfig: {
      systemPrompt: "",
      skills: {},
      roles: {},
      model: undefined,
      resolveModel,
    },
    createDefaultEnv: async (): Promise<SessionEnv> => bashFactoryToSessionEnv(sandbox),
    createLocalEnv: async (): Promise<SessionEnv> => {
      throw new Error("Trellis Cloudflare agents use the Trellis virtual sandbox by default.");
    },
    defaultStore: createTrellisSessionStore(env),
  });
}

async function preloadTrellisPacks(
  sandbox: Awaited<ReturnType<typeof getVirtualSandbox>>,
  input: TrellisRuntimeContextFactoryInput,
) {
  const bash = await Promise.resolve(sandbox());
  await bash.fs.mkdir("/workspace/.agents/skills", { recursive: true });
  await bash.fs.mkdir("/workspace/knowledge", { recursive: true });
  await bash.fs.writeFile("/workspace/AGENTS.md", renderAgentsMd(input));

  for (const file of readPackFiles(input.packs, "knowledge")) {
    const target = workspaceFile("knowledge", file.path);
    await ensureParentDir(bash, target);
    await bash.fs.writeFile(target, file.text);
  }

  for (const file of readPackFiles(input.packs, "skills")) {
    const target = workspaceFile(".agents/skills", file.path);
    await ensureParentDir(bash, target);
    await bash.fs.writeFile(target, file.text);
  }
}

function renderAgentsMd(input: TrellisRuntimeContextFactoryInput) {
  const knowledge = readPackFiles(input.packs, "knowledge")
    .map((file) => \`- knowledge/\${safePackPath(file.path)}\`)
    .join("\\n");
  return \`You are a Trellis GTM agent.

Use the mounted markdown knowledge and SKILL.md files to complete the requested GTM step.
Never send email, update CRM, or call handoff webhooks directly. Trellis approval gates own those side effects.

Knowledge files:
\${knowledge || "- none mounted yet"}
\`;
}

async function ensureParentDir(bash: { fs: { mkdir(path: string, options?: { recursive?: boolean }): Promise<void> } }, filePath: string) {
  const parent = filePath.split("/").slice(0, -1).join("/") || "/";
  await bash.fs.mkdir(parent, { recursive: true });
}

function readPackFiles(packs: unknown, scope: "knowledge" | "skills"): PackFile[] {
  const root = asRecord(packs);
  const section = asRecord(root?.[scope]);
  const files = Array.isArray(section?.files) ? section.files : [];
  return files.flatMap((file) => {
    const record = asRecord(file);
    const filePath = typeof record?.path === "string" ? record.path : undefined;
    const text = typeof record?.text === "string" ? record.text : undefined;
    return filePath && text ? [{ path: filePath, text }] : [];
  });
}

function workspaceFile(prefix: string, packPath: string) {
  return \`/workspace/\${prefix}/\${safePackPath(packPath)}\`;
}

function safePackPath(value: string) {
  const normalized = value
    .split(/[\\\\/]+/)
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return normalized || "untitled.md";
}

function stableAgentId(input: TrellisRuntimeContextFactoryInput) {
  return normalizeId(input.signal.workspaceId ?? input.signal.id ?? "default");
}

function stableRunId(input: TrellisRuntimeContextFactoryInput) {
  return normalizeId(input.signal.traceId ?? input.signal.id ?? \`run_\${Date.now()}\`);
}

function normalizeId(value: unknown) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 128) || "default";
}

function readAiGatewayId(env: TrellisEnv) {
  return typeof env.TRELLIS_AI_GATEWAY_ID === "string" && env.TRELLIS_AI_GATEWAY_ID.trim()
    ? env.TRELLIS_AI_GATEWAY_ID.trim()
    : "default";
}

function createTrellisAiBinding(binding: unknown) {
  const ai = binding as { run?: (model: string, payload: unknown, options?: unknown) => Promise<unknown> | unknown };
  if (typeof ai.run !== "function") {
    return binding;
  }

  return {
    ...ai,
    run(model: string, payload: unknown, options?: unknown) {
      return ai.run?.(model, normalizeTrellisAiPayload(model, payload), options);
    },
  };
}

function normalizeTrellisAiPayload(model: string, payload: unknown) {
  if (!model.startsWith("anthropic/")) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return payload;
  }

  const system: string[] = [];
  const messages = Array.isArray(record.messages) ? record.messages.flatMap((message) => {
    const item = asRecord(message);
    const role = typeof item?.role === "string" ? item.role : undefined;
    const content = normalizeMessageContent(item?.content);
    if (!role || !content) {
      return [];
    }
    if (role === "system") {
      system.push(content);
      return [];
    }
    const normalizedRole = role === "assistant" ? "assistant" : "user";
    return [{ ...item, role: normalizedRole, content }];
  }) : record.messages;

  const normalized: Record<string, unknown> = {
    ...record,
    messages,
    tools: normalizeTrellisTools(record.tools),
    max_tokens: readPositiveNumber(record.max_tokens)
      ?? readPositiveNumber(record.max_completion_tokens)
      ?? 2048,
  };
  delete normalized.max_completion_tokens;
  delete normalized.stream_options;
  if (system.length > 0) {
    normalized.system = system.join("\\n\\n");
  }
  return normalized;
}

function normalizeTrellisTools(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.flatMap((tool) => {
    const record = asRecord(tool);
    if (record?.type !== "function") {
      return record ? [record] : [];
    }

    const fn = asRecord(record.function);
    if (!fn) {
      return [];
    }
    const name = typeof fn.name === "string" ? fn.name : undefined;
    if (!name) {
      return [];
    }

    return [{
      type: "custom",
      name: normalizeTrellisToolName(name),
      description: typeof fn.description === "string" ? fn.description : "",
      input_schema: asRecord(fn.parameters) ?? {
        type: "object",
        properties: {},
      },
    }];
  });
}

function normalizeTrellisToolName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 128) || "tool";
}

function normalizeMessageContent(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.flatMap((part) => {
      const record = asRecord(part);
      const text = typeof record?.text === "string" ? record.text : undefined;
      return text ? [text] : [];
    }).join("\\n");
  }
  return undefined;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function createTrellisSessionStore(env: TrellisEnv): SessionStore {
  const db = env.TRELLIS_DB;
  if (!db?.prepare) {
    return createMemorySessionStore();
  }

  let ready: Promise<unknown> | undefined;
  const ensureReady = () => {
    ready ??= db.prepare(\`
      CREATE TABLE IF NOT EXISTS trellis_agent_sessions (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    \`).bind().run();
    return ready;
  };

  return {
    async save(id, data) {
      await ensureReady();
      await db.prepare(\`
        INSERT OR REPLACE INTO trellis_agent_sessions (id, data_json, updated_at)
        VALUES (?, ?, ?)
      \`).bind(id, JSON.stringify(data), new Date().toISOString()).run();
    },
    async load(id) {
      await ensureReady();
      const row = await db.prepare("SELECT data_json FROM trellis_agent_sessions WHERE id = ?")
        .bind(id)
        .first<{ data_json: string }>();
      return row ? JSON.parse(row.data_json) as SessionData : null;
    },
    async delete(id) {
      await ensureReady();
      await db.prepare("DELETE FROM trellis_agent_sessions WHERE id = ?").bind(id).run();
    },
  };
}

function createMemorySessionStore(): SessionStore {
  const sessions = new Map<string, SessionData>();
  return {
    async save(id, data) {
      sessions.set(id, data);
    },
    async load(id) {
      return sessions.get(id) ?? null;
    },
    async delete(id) {
      sessions.delete(id);
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
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
npm run cf:login
npm run deploy
npm run smoke
npm run verify
\`\`\`

The first deploy is Cloudflare-first and does not require Attio, AgentMail, or Firecrawl credentials. Those are connected after the app boots:

\`\`\`bash
npm run trellis -- connect attio
npm run trellis -- connect agentmail
npm run trellis -- connect firecrawl
npm run trellis -- connect apify      # optional discovery source
npm run trellis -- connect prospeo    # optional email enrichment
npm run trellis -- docs add ./product-docs
\`\`\`

Your app code stays Trellis-only in \`src/agent.ts\`. Attio field mapping lives in \`src/crm/attio.map.ts\`: rename the keys to your Attio attribute API slugs, then point each value at extracted Trellis context like \`qualification.decision\`, \`qualification.summary\`, or \`signal.payload.signal\`. Durable business state lives in \`src/state/prospect.map.ts\`: define tables, fields, indexes, and relationships while Trellis keeps D1 migrations private. The generated \`src/trellis-runtime.ts\` adapter installs the hidden Trellis runtime, mounts Trellis R2 markdown packs into the virtual sandbox, uses the Cloudflare AI binding through the default AI Gateway, and stores agent sessions in \`TRELLIS_DB\`.

Deploy auto-packs the default \`knowledge/**/*.md\` files, or uses \`.trellis/knowledge-pack.json\` when you run \`trellis docs add <path>\`. It also syncs tracked \`SKILL.md\` files into the \`TRELLIS_PACKS\` R2 bucket. Outbound writes stay in no-send mode until approval gates are configured.

\`GET /smoke\` is safe and never writes to providers. \`POST /smoke/attio\` is an explicit provider smoke: it requires \`ATTIO_API_KEY\` plus \`TRELLIS_PROVIDER_SMOKE_TOKEN\`, writes a deterministic smoke company/person through the Attio field map, and returns HTTP 200 only when Attio accepts the mapped write.
`;
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

function resolveLocalMcpUrl(flags: Record<string, string | boolean>) {
  const port = typeof flags.port === "string" ? flags.port : (process.env.PORT ?? "3000");
  return `http://localhost:${port}/mcp/trellis`;
}

function resolveRemoteMcpUrl() {
  const appUrl = process.env.TRELLIS_WORKER_URL ?? process.env.APP_URL ?? "https://your-worker.workers.dev";
  return `${appUrl.replace(/\/$/, "")}/mcp/trellis`;
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

function readFlagString(flags: Record<string, string | boolean>, names: string[]) {
  for (const name of names) {
    const value = flags[name];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
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
