import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("trellis init v3 scaffold", () => {
  it("keeps default help focused on the v3 happy path", () => {
    const repoRoot = process.cwd();
    const output = runCli(repoRoot, ["help"], repoRoot);

    expect(output).toContain("npm run trellis -- init <target-dir> [--name my-app]");
    expect(output).toContain("Cloudflare is the default deploy target.");
    expect(output).toContain("npm run trellis -- verify cloudflare --json");
    expect(output).not.toContain("trellis add");
    expect(output).not.toContain("--legacy");
    expect(output).not.toContain("Convex");
    expect(output).not.toContain("Vercel");
    expect(output).not.toContain("Rivet");
  });

  it("emits a v3-only Cloudflare GTM scaffold", () => {
    const repoRoot = process.cwd();
    const targetDir = mkdtempSync(path.join(tmpdir(), "trellis-init-test."));
    const cliPath = path.join(repoRoot, "packages", "trellis-cli", "src", "cli.ts");

    try {
      const output = runCli(repoRoot, [
        "init",
        targetDir,
        "--name",
        "test-sdr",
        "--json",
      ], repoRoot);

      const initResult = JSON.parse(output) as {
        mode: string;
        filesWritten: string[];
      };
      const generatedPackage = JSON.parse(readFileSync(path.join(targetDir, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      const agentSource = readFileSync(path.join(targetDir, "src", "agent.ts"), "utf8");
      const workerSource = readFileSync(path.join(targetDir, "src", "index.ts"), "utf8");
      const flueSource = readFileSync(path.join(targetDir, "src", "trellis-flue.ts"), "utf8");
      const wranglerConfig = readFileSync(path.join(targetDir, "wrangler.jsonc"), "utf8");
      const envExample = readFileSync(path.join(targetDir, ".env.example"), "utf8");
      const readme = readFileSync(path.join(targetDir, "README.md"), "utf8");
      const dependencySpecs = [
        ...Object.values(generatedPackage.dependencies),
        ...Object.values(generatedPackage.devDependencies),
      ];

      expect(initResult.mode).toBe("v3-cloudflare-gtm");
      expect(initResult.filesWritten).toContain("src/agent.ts");
      expect(initResult.filesWritten).toContain("src/trellis-flue.ts");
      expect(dependencySpecs).not.toContain("workspace:*");
      expect(generatedPackage.dependencies["@trellis/gtm"]).toMatch(/^file:\/\//);
      expect(generatedPackage.dependencies["@trellis/providers"]).toMatch(/^file:\/\//);
      expect(generatedPackage.devDependencies["@trellis/cli"]).toMatch(/^file:\/\//);
      expect(generatedPackage.scripts.doctor).toBe("trellis doctor");
      expect(generatedPackage.scripts.deploy).toBe("trellis deploy");
      expect(generatedPackage.scripts.smoke).toBe("trellis smoke");
      expect(generatedPackage.scripts.verify).toBe("trellis verify cloudflare");
      expect(generatedPackage.devDependencies.tsx).toBeDefined();
      expect(readFileSync(cliPath, "utf8")).toMatch(/^#!\/usr\/bin\/env tsx/);

      expect(agentSource).toContain("trellis.agent(\"sdr\"");
      expect(agentSource).toContain("trellis.safeOutbound()");
      expect(agentSource).toContain("app.skill(\"icp-qualification\"");
      expect(agentSource).not.toContain("@flue/sdk");
      expect(agentSource).not.toContain("FlueContext");
      expect(agentSource).not.toContain("Cloudflare");

      expect(workerSource).toContain("trellis.cloudflare(agent)");
      expect(workerSource).toContain("withTrellisFlue(env, request)");
      expect(flueSource).toContain("@flue/sdk/cloudflare");
      expect(flueSource).toContain("getCloudflareAIBindingApiProvider");
      expect(flueSource).toContain("getVirtualSandbox");
      expect(flueSource).toContain("TRELLIS_FLUE_CONTEXT_FACTORY");
      expect(flueSource).toContain("trellis_flue_sessions");
      expect(flueSource).toContain("readPackFiles(input.packs, \"knowledge\")");
      expect(flueSource).toContain("readPackFiles(input.packs, \"skills\")");

      expect(wranglerConfig).toContain("\"ai\"");
      expect(wranglerConfig).toContain("\"browser\"");
      expect(wranglerConfig).toContain("\"durable_objects\"");
      expect(wranglerConfig).toContain("\"d1_databases\"");
      expect(wranglerConfig).toContain("\"r2_buckets\"");
      expect(wranglerConfig).toContain("\"queues\"");
      expect(wranglerConfig).toContain("\"dead_letter_queue\"");
      expect(wranglerConfig).toContain("\"workflows\"");

      expect(envExample).toContain("CLOUDFLARE_ACCOUNT_ID=");
      expect(envExample).toContain("CLOUDFLARE_API_TOKEN=");
      expect(envExample).toContain("ATTIO_API_KEY=");
      expect(envExample).toContain("AGENTMAIL_API_KEY=");
      expect(envExample).toContain("FIRECRAWL_API_KEY=");
      expect(envExample).toContain("TRELLIS_FOLLOW_UP_DELAY=3 days");
      expect(readme).toContain("first deploy is Cloudflare-first");
      expect(readme).toContain("Your app code stays Trellis-only in `src/agent.ts`");

      expect(existsSync(path.join(targetDir, "trellis.config.ts"))).toBe(false);
      expect(existsSync(path.join(targetDir, "src", "app-config.ts"))).toBe(false);
      expect(existsSync(path.join(targetDir, "TRELLIS_SETUP.md"))).toBe(false);
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("rejects old architecture commands from the v3 CLI surface", () => {
    const repoRoot = process.cwd();
    const targetDir = mkdtempSync(path.join(tmpdir(), "trellis-legacy-reject-test."));

    try {
      expect(runCliFailure(repoRoot, ["add", "source", "apify", "--legacy"], repoRoot))
        .toContain("trellis add is old composition tooling");
      expect(runCliFailure(repoRoot, ["deploy", "vercel", "--legacy"], repoRoot))
        .toContain("Deploy target \"vercel\" is old architecture");
      expect(runCliFailure(repoRoot, ["init", targetDir, "--legacy"], repoRoot))
        .toContain("trellis init --legacy/--kit is old composition tooling");
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("runs the generated first-run spine without provider credentials", () => {
    const repoRoot = process.cwd();
    const targetDir = mkdtempSync(path.join(tmpdir(), "trellis-first-run-test."));

    try {
      runCli(repoRoot, [
        "init",
        targetDir,
        "--name",
        "first-run-sdr",
        "--json",
      ], repoRoot);

      const docsResult = JSON.parse(runCli(repoRoot, [
        "docs",
        "add",
        "./knowledge",
        "--json",
      ], targetDir)) as {
        files: Array<{ path: string }>;
        target: string;
      };
      expect(docsResult.target).toBe("R2-backed Trellis knowledge pack");
      expect(docsResult.files.map((file) => file.path)).toEqual(["knowledge/icp.md"]);

      const doctorResult = JSON.parse(runCli(repoRoot, [
        "doctor",
        "--json",
      ], targetDir)) as {
        ok: boolean;
        mode: string;
        checks: Array<{ id: string; status: string; detail: string }>;
        knowledgePack: { files: number } | null;
        skillPack: { files: string[] } | null;
      };
      expect(doctorResult.ok).toBe(true);
      expect(doctorResult.mode).toBe("v3-cloudflare-gtm");
      expect(doctorResult.checks.find((check) => check.id === "cloudflare.config")?.status).toBe("pass");
      expect(doctorResult.checks.find((check) => check.id === "binding.TRELLIS_DB")?.status).toBe("pass");
      expect(doctorResult.checks.find((check) => check.id === "binding.TRELLIS_PACKS")?.status).toBe("pass");
      expect(doctorResult.checks.find((check) => check.id === "binding.TRELLIS_EVENTS")?.status).toBe("pass");
      expect(doctorResult.checks.find((check) => check.id === "binding.PROSPECT_WORKFLOW")?.status).toBe("pass");
      expect(doctorResult.checks.find((check) => check.id === "binding.AI")?.status).toBe("pass");
      expect(doctorResult.checks.find((check) => check.id === "binding.BROWSER")?.status).toBe("pass");
      expect(doctorResult.checks.find((check) => check.id === "cloudflare.d1.database")?.detail).toContain("trellis deploy will resolve or create it");
      expect(doctorResult.knowledgePack?.files).toBe(1);
      expect(doctorResult.skillPack?.files).toHaveLength(5);

      const smokeResult = JSON.parse(runCli(repoRoot, [
        "smoke",
        "--json",
      ], targetDir)) as {
        ok: boolean;
        noSendsMode: boolean;
        externalWrites: boolean;
        prospects: unknown[];
        drafts: Array<{ status: string }>;
        auditEvents: Array<{ type: string }>;
        knowledgePack: { files: number } | null;
      };
      expect(smokeResult.ok).toBe(true);
      expect(smokeResult.noSendsMode).toBe(true);
      expect(smokeResult.externalWrites).toBe(false);
      expect(smokeResult.prospects).toHaveLength(1);
      expect(smokeResult.drafts[0]?.status).toBe("blocked_pending_approval");
      expect(smokeResult.auditEvents.map((event) => event.type)).toContain("draft.created");
      expect(smokeResult.knowledgePack?.files).toBe(1);

      const deployResult = JSON.parse(runCli(repoRoot, [
        "deploy",
        "--json",
      ], targetDir)) as {
        target: string;
        mode: string;
        firstBoot: {
          requiresProviderCredentials: boolean;
          noSendsMode: boolean;
          smokeMode: boolean;
        };
        cloudflare: {
          autoProvisionable: boolean;
          readyForDeploy: boolean;
          resources: Array<{ id: string; ready: boolean; detail: string }>;
        };
        packSync: {
          enabled: boolean;
          syncable: boolean;
          entries: Array<{ objectKey: string }>;
        };
        providers: Record<string, { connected: boolean; status: string }>;
      };
      expect(deployResult.target).toBe("cloudflare");
      expect(deployResult.mode).toBe("plan");
      expect(deployResult.firstBoot).toEqual({
        requiresProviderCredentials: false,
        noSendsMode: true,
        smokeMode: true,
      });
      expect(deployResult.cloudflare.autoProvisionable).toBe(true);
      expect(deployResult.cloudflare.readyForDeploy).toBe(false);
      expect(deployResult.cloudflare.resources.find((resource) => resource.id === "d1.database")?.detail).toContain("trellis deploy will resolve or create it");
      expect(deployResult.packSync.enabled).toBe(true);
      expect(deployResult.packSync.syncable).toBe(true);
      expect(deployResult.packSync.entries.map((entry) => entry.objectKey)).toEqual(expect.arrayContaining([
        "knowledge/manifest.json",
        "knowledge/files/icp.md",
        "skills/files/icp-qualification/SKILL.md",
        "skills/files/research-brief/SKILL.md",
        "skills/files/sdr-copy/SKILL.md",
        "skills/files/reply-policy/SKILL.md",
        "skills/files/handoff-policy/SKILL.md",
      ]));
      expect(deployResult.providers.attio).toMatchObject({ connected: false, status: "not_connected" });
      expect(deployResult.providers.agentmail).toMatchObject({ connected: false, status: "not_connected" });
      expect(deployResult.providers.firecrawl).toMatchObject({ connected: false, status: "not_connected" });

      const verifyResult = JSON.parse(runCli(repoRoot, [
        "verify",
        "cloudflare",
        "--json",
      ], targetDir)) as {
        ok: boolean;
        target: string;
        mode: string;
        live: boolean;
        endpoint: string | null;
        checks: Array<{ id: string; status: string; detail: string }>;
        cloudflare: {
          autoProvisionable: boolean;
          readyForDeploy: boolean;
        };
        packSync: {
          syncable: boolean;
          entries: Array<{ objectKey: string }>;
        };
      };
      expect(verifyResult.ok).toBe(true);
      expect(verifyResult.target).toBe("cloudflare");
      expect(verifyResult.mode).toBe("local");
      expect(verifyResult.live).toBe(false);
      expect(verifyResult.endpoint).toBeNull();
      expect(verifyResult.checks.find((check) => check.id === "source.agent")?.status).toBe("pass");
      expect(verifyResult.checks.find((check) => check.id === "source.worker")?.status).toBe("pass");
      expect(verifyResult.checks.find((check) => check.id === "source.flueAdapter")?.status).toBe("pass");
      expect(verifyResult.checks.find((check) => check.id === "cloudflare.autoProvisionable")?.status).toBe("pass");
      expect(verifyResult.checks.find((check) => check.id === "packSync.plan")?.status).toBe("pass");
      expect(verifyResult.checks.find((check) => check.id === "smoke.local")?.status).toBe("pass");
      expect(verifyResult.checks.find((check) => check.id === "wrangler.auth")?.status).toBe("skip");
      expect(verifyResult.checks.find((check) => check.id === "remote.webhook.agent")?.status).toBe("skip");
      expect(verifyResult.cloudflare.autoProvisionable).toBe(true);
      expect(verifyResult.cloudflare.readyForDeploy).toBe(false);
      expect(verifyResult.packSync.syncable).toBe(true);
      expect(verifyResult.packSync.entries.map((entry) => entry.objectKey)).toEqual(expect.arrayContaining([
        "knowledge/manifest.json",
        "knowledge/files/icp.md",
        "skills/files/icp-qualification/SKILL.md",
      ]));

      const connectedProviders = [
        ["attio", "ATTIO_API_KEY"],
        ["agentmail", "AGENTMAIL_API_KEY"],
        ["firecrawl", "FIRECRAWL_API_KEY"],
      ] as const;
      for (const [provider, requiredEnv] of connectedProviders) {
        const connectResult = JSON.parse(runCli(repoRoot, [
          "connect",
          provider,
          "--json",
        ], targetDir)) as {
          mode: string;
          manifest: {
            path: string;
            status: string;
            missingRequiredEnv: string[];
          };
        };
        expect(connectResult.mode).toBe("v3-provider");
        expect(connectResult.manifest.status).toBe("waiting_for_env");
        expect(connectResult.manifest.missingRequiredEnv).toContain(requiredEnv);

        const manifest = JSON.parse(readFileSync(connectResult.manifest.path, "utf8")) as {
          id: string;
          noSecretsStored: boolean;
          requiredEnv: string[];
          missingRequiredEnv: string[];
          status: string;
        };
        expect(manifest).toMatchObject({
          id: provider,
          noSecretsStored: true,
          status: "waiting_for_env",
        });
        expect(manifest.requiredEnv).toContain(requiredEnv);
        expect(manifest.missingRequiredEnv).toContain(requiredEnv);
        expect(JSON.stringify(manifest)).not.toContain("apiKey");
      }

      const connectedDoctorResult = JSON.parse(runCli(repoRoot, [
        "doctor",
        "--json",
      ], targetDir)) as {
        providers: Record<string, { connected: boolean; status: string; missingRequiredEnv: string[] }>;
      };
      expect(connectedDoctorResult.providers.attio).toMatchObject({
        connected: true,
        status: "waiting_for_env",
        missingRequiredEnv: ["ATTIO_API_KEY"],
      });
      expect(connectedDoctorResult.providers.agentmail).toMatchObject({
        connected: true,
        status: "waiting_for_env",
        missingRequiredEnv: ["AGENTMAIL_API_KEY"],
      });
      expect(connectedDoctorResult.providers.firecrawl).toMatchObject({
        connected: true,
        status: "waiting_for_env",
        missingRequiredEnv: ["FIRECRAWL_API_KEY"],
      });
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

function runCli(repoRoot: string, args: string[], cwd: string) {
  const env = { ...process.env };
  for (const name of [
    "ATTIO_API_KEY",
    "AGENTMAIL_API_KEY",
    "FIRECRAWL_API_KEY",
    "LANGFUSE_PUBLIC_KEY",
    "LANGFUSE_SECRET_KEY",
    "BRAINTRUST_API_KEY",
    "BRAINTRUST_PROJECT_ID",
  ]) {
    delete env[name];
  }

  return execFileSync(process.execPath, [
    path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(repoRoot, "packages", "trellis-cli", "src", "cli.ts"),
    ...args,
  ], {
    cwd,
    env,
    encoding: "utf8",
  });
}

function runCliFailure(repoRoot: string, args: string[], cwd: string) {
  try {
    runCli(repoRoot, args, cwd);
  } catch (error) {
    const result = error as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    expect(result.status).not.toBe(0);
    return `${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`;
  }

  throw new Error(`Expected CLI command to fail: ${args.join(" ")}`);
}
