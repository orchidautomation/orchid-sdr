import { execFile, execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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
        overrides: Record<string, string>;
      };
      const agentSource = readFileSync(path.join(targetDir, "src", "agent.ts"), "utf8");
      const workerSource = readFileSync(path.join(targetDir, "src", "index.ts"), "utf8");
      const flueSource = readFileSync(path.join(targetDir, "src", "trellis-flue.ts"), "utf8");
      const attioMapSource = readFileSync(path.join(targetDir, "src", "crm", "attio.map.ts"), "utf8");
      const stateMapSource = readFileSync(path.join(targetDir, "src", "state", "prospect.map.ts"), "utf8");
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
      expect(initResult.filesWritten).toContain("src/crm/attio.map.ts");
      expect(initResult.filesWritten).toContain("src/state/prospect.map.ts");
      expect(dependencySpecs).not.toContain("workspace:*");
      expect(generatedPackage.dependencies["@trellis/gtm"]).toMatch(/^file:\/\//);
      expect(generatedPackage.dependencies["@trellis/providers"]).toMatch(/^file:\/\//);
      expect(generatedPackage.devDependencies["@trellis/cli"]).toMatch(/^file:\/\//);
      expect(generatedPackage.scripts.trellis).toBe("trellis");
      expect(generatedPackage.scripts.doctor).toBe("trellis doctor");
      expect(generatedPackage.scripts["docs:add"]).toBe("trellis docs add ./knowledge");
      expect(generatedPackage.scripts.deploy).toBe("trellis deploy");
      expect(generatedPackage.scripts.smoke).toBe("trellis smoke");
      expect(generatedPackage.scripts.verify).toBe("trellis verify cloudflare");
      expect(generatedPackage.scripts["cf:login"]).toBe("wrangler login");
      expect(generatedPackage.overrides["@mistralai/mistralai"]).toBe("npm:no-op@1.0.3");
      expect(generatedPackage.devDependencies.tsx).toBeDefined();
      expect(readFileSync(cliPath, "utf8")).toMatch(/^#!\/usr\/bin\/env tsx/);

      expect(agentSource).toContain("trellis.agent(\"sdr\"");
      expect(agentSource).toContain("import attioMap from \"./crm/attio.map\"");
      expect(agentSource).toContain("import stateMap from \"./state/prospect.map\"");
      expect(agentSource).toContain("crm: attio({ map: attioMap })");
      expect(agentSource).toContain("state: stateMap");
      expect(agentSource).toContain("model: \"anthropic/claude-sonnet-4.6\"");
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
      expect(flueSource).toContain("TRELLIS_AI_GATEWAY_ID");
      expect(flueSource).toContain("gateway: { id: readAiGatewayId(env) }");
      expect(flueSource).toContain("trellis_flue_sessions");
      expect(flueSource).toContain("readPackFiles(input.packs, \"knowledge\")");
      expect(flueSource).toContain("readPackFiles(input.packs, \"skills\")");
      expect(flueSource.indexOf("const env = (input.env ?? {}) as TrellisEnv;"))
        .toBeLessThan(flueSource.indexOf("registerProvider(\"cloudflare\""));
      expect(attioMapSource).toContain("satisfies TrellisAttioMap");
      expect(attioMapSource).toContain("companies:");
      expect(attioMapSource).toContain("people:");
      expect(attioMapSource).toContain("latest_signal");
      expect(stateMapSource).toContain("trellis.state");
      expect(stateMapSource).toContain("tables:");
      expect(stateMapSource).toContain("prospects:");
      expect(stateMapSource).toContain("relationships:");
      expect(stateMapSource).toContain("qualification.summary");

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
      expect(envExample).toContain("TRELLIS_PROVIDER_SMOKE_TOKEN=");
      expect(envExample).toContain("AGENTMAIL_API_KEY=");
      expect(envExample).toContain("FIRECRAWL_API_KEY=");
      expect(envExample).toContain("APIFY_TOKEN=");
      expect(envExample).toContain("PROSPEO_API_KEY=");
      expect(envExample).toContain("TRELLIS_AI_GATEWAY_ID=default");
      expect(envExample).toContain("TRELLIS_FOLLOW_UP_DELAY=3 days");
      expect(readme).toContain("first deploy is Cloudflare-first");
      expect(readme).toContain("npm run cf:login");
      expect(readme).toContain("Deploy auto-packs the default `knowledge/**/*.md` files");
      expect(readme).toContain("POST /smoke/attio");
      expect(readme).toContain("npm run trellis -- connect attio");
      expect(readme).toContain("Your app code stays Trellis-only in `src/agent.ts`");

      expect(existsSync(path.join(targetDir, "trellis.config.ts"))).toBe(false);
      expect(existsSync(path.join(targetDir, "src", "app-config.ts"))).toBe(false);
      expect(existsSync(path.join(targetDir, "TRELLIS_SETUP.md"))).toBe(false);
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("auto-packs scaffold knowledge without an explicit docs add step", () => {
    const repoRoot = process.cwd();
    const targetDir = mkdtempSync(path.join(tmpdir(), "trellis-auto-pack-test."));

    try {
      const initResult = JSON.parse(runCli(repoRoot, [
        "init",
        targetDir,
        "--name",
        "auto-pack-sdr",
        "--json",
      ], repoRoot)) as {
        nextSteps: string[];
      };
      expect(initResult.nextSteps).not.toContain("npm run docs:add");
      expect(initResult.nextSteps).toContain("npm run deploy");
      expect(existsSync(path.join(targetDir, ".trellis", "knowledge-pack.json"))).toBe(false);

      const doctorResult = JSON.parse(runCli(repoRoot, [
        "doctor",
        "--json",
      ], targetDir)) as {
        knowledgePack: { files: number; generated?: boolean; manifestPath: string | null } | null;
      };
      expect(doctorResult.knowledgePack).toMatchObject({
        files: 1,
        generated: true,
        manifestPath: null,
      });

      const deployResult = JSON.parse(runCli(repoRoot, [
        "deploy",
        "--json",
      ], targetDir)) as {
        packSync: {
          entries: Array<{ objectKey: string }>;
        };
      };
      expect(deployResult.packSync.entries.map((entry) => entry.objectKey)).toEqual(expect.arrayContaining([
        "knowledge/files/icp.md",
        "skills/files/icp-qualification/SKILL.md",
      ]));
      expect(deployResult.packSync.entries.map((entry) => entry.objectKey)).not.toContain("knowledge/manifest.json");
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
      expect(doctorResult.checks.find((check) => check.id === "cloudflare.aiGateway")?.status).toBe("pass");
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
        aiGateway: {
          enabled: boolean;
          gatewayId: string;
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
      expect(deployResult.aiGateway).toMatchObject({
        enabled: true,
        gatewayId: "default",
      });
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
      expect(verifyResult.checks.find((check) => check.id === "cloudflare.aiGateway")?.status).toBe("pass");
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
        ["apify", "APIFY_TOKEN"],
        ["prospeo", "PROSPEO_API_KEY"],
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
      expect(connectedDoctorResult.providers.apify).toMatchObject({
        connected: true,
        status: "waiting_for_env",
        missingRequiredEnv: ["APIFY_TOKEN"],
      });
      expect(connectedDoctorResult.providers.prospeo).toMatchObject({
        connected: true,
        status: "waiting_for_env",
        missingRequiredEnv: ["PROSPEO_API_KEY"],
      });
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("verifies live Cloudflare exercise artifacts from the deployed worker", async () => {
    const repoRoot = process.cwd();
    const targetDir = mkdtempSync(path.join(tmpdir(), "trellis-live-verify-test."));
    const fakeBinDir = mkdtempSync(path.join(tmpdir(), "trellis-fake-bin."));
    const fakeNpxPath = path.join(fakeBinDir, "npx");
    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/healthz") {
        writeJson(response, {
          ok: true,
          stack: "trellis-v3-cloudflare",
        });
        return;
      }
      if (url.pathname === "/smoke") {
        writeJson(response, {
          ok: true,
          externalWrites: false,
        });
        return;
      }
      if (url.pathname === "/mcp/trellis") {
        writeJson(response, {
          ok: true,
          tools: ["trellis.health", "trellis.workflow.inspect"],
          snapshot: {
            counts: {
              signals: 1,
              providerRuns: 1,
              workflowRuns: 1,
              approvals: 1,
              providerActions: 1,
            },
          },
        });
        return;
      }
      if (url.pathname === "/webhooks/signals" && request.method === "POST") {
        const body = JSON.parse(await readRequestText(request)) as { id?: string };
        writeJson(response, {
          ok: true,
          accepted: true,
          mode: "processed",
          signal: {
            id: body.id ?? "sig_verify",
          },
          auditEvents: [
            { type: "signal.accepted" },
            { type: "skill.completed" },
          ],
          approvals: [
            {
              id: "approval_draft_sig_verify_email_send",
              signalId: body.id ?? "sig_verify",
              draftId: "draft_sig_verify",
              action: "email.send",
              status: "pending",
            },
          ],
          persistence: {
            enabled: true,
          },
          providerRun: {
            enabled: true,
            status: "succeeded",
          },
          queue: {
            enabled: true,
            messages: 1,
          },
          workflowDispatch: {
            enabled: true,
            ok: true,
            instanceId: "trellis_sig_verify_prospect",
          },
          packs: {
            enabled: true,
            knowledge: { objects: 1 },
            skills: { objects: 5 },
          },
          noSendsMode: true,
        }, 202);
        return;
      }
      if (url.pathname === "/operator/workflows/trellis_sig_verify_prospect/replay" && request.method === "POST") {
        writeJson(response, {
          ok: true,
          workflowRunId: "trellis_sig_verify_prospect",
          replayId: "trellis_sig_verify_prospect_verify_replay",
          workflow: "prospect",
          persistence: {
            enabled: true,
            status: "replayed",
          },
        });
        return;
      }
      if (url.pathname === "/approvals/approval_draft_sig_verify_email_send/approve" && request.method === "POST") {
        writeJson(response, {
          ok: true,
          approval: {
            id: "approval_draft_sig_verify_email_send",
            status: "approved",
          },
          providerAction: {
            id: "provider_action_approval_draft_sig_verify_email_send",
            status: "blocked_no_send",
          },
        });
        return;
      }
      if (url.pathname === "/operator/provider-actions/provider_action_approval_draft_sig_verify_email_send/replay" && request.method === "POST") {
        writeJson(response, {
          ok: true,
          providerAction: {
            id: "provider_action_approval_draft_sig_verify_email_send",
            status: "queued",
          },
          queue: {
            enabled: true,
            messages: 1,
          },
        });
        return;
      }
      writeJson(response, { ok: false, error: "not_found" }, 404);
    });

    try {
      writeFileSync(fakeNpxPath, "#!/bin/sh\nif [ \"$1\" = \"wrangler\" ] && [ \"$2\" = \"whoami\" ]; then echo 'test@example.com'; exit 0; fi\nexit 0\n");
      chmodSync(fakeNpxPath, 0o755);
      await listen(server);

      runCli(repoRoot, [
        "init",
        targetDir,
        "--name",
        "live-verify-sdr",
        "--json",
      ], repoRoot);
      runCli(repoRoot, [
        "docs",
        "add",
        "./knowledge",
        "--json",
      ], targetDir);

      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected test server to listen on a TCP port.");
      }
      const verifyResult = JSON.parse(await runCliAsync(repoRoot, [
        "verify",
        "cloudflare",
        "--url",
        `http://127.0.0.1:${address.port}`,
        "--exercise-agent",
        "--json",
      ], targetDir, {
        PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
      })) as {
        ok: boolean;
        mode: string;
        live: boolean;
        exerciseAgent: boolean;
        checks: Array<{ id: string; status: string }>;
      };
      const checks = new Map(verifyResult.checks.map((check) => [check.id, check.status]));

      expect(verifyResult).toMatchObject({
        ok: true,
        mode: "live",
        live: true,
        exerciseAgent: true,
      });
      expect(checks.get("wrangler.auth")).toBe("pass");
      expect(checks.get("remote.healthz")).toBe("pass");
      expect(checks.get("remote.mcp")).toBe("pass");
      expect(checks.get("remote.smoke")).toBe("pass");
      expect(checks.get("remote.webhook.agent")).toBe("pass");
      expect(checks.get("remote.webhook.persistence")).toBe("pass");
      expect(checks.get("remote.webhook.workflow")).toBe("pass");
      expect(checks.get("remote.webhook.queue")).toBe("pass");
      expect(checks.get("remote.webhook.packs")).toBe("pass");
      expect(checks.get("remote.webhook.safety")).toBe("pass");
      expect(checks.get("remote.operator.workflowReplay")).toBe("pass");
      expect(checks.get("remote.operator.approvalGate")).toBe("pass");
      expect(checks.get("remote.operator.providerActionReplay")).toBe("pass");
      expect(checks.get("remote.state.snapshot")).toBe("pass");
    } finally {
      await close(server);
      rmSync(targetDir, { recursive: true, force: true });
      rmSync(fakeBinDir, { recursive: true, force: true });
    }
  });
});

function cliProcessArgs(repoRoot: string, args: string[]) {
  return [
    path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(repoRoot, "packages", "trellis-cli", "src", "cli.ts"),
    ...args,
  ];
}

function buildCliEnv(extraEnv: Record<string, string> = {}) {
  const env = { ...process.env };
  for (const name of [
    "ATTIO_API_KEY",
    "AGENTMAIL_API_KEY",
    "FIRECRAWL_API_KEY",
    "APIFY_TOKEN",
    "PROSPEO_API_KEY",
    "LANGFUSE_PUBLIC_KEY",
    "LANGFUSE_SECRET_KEY",
    "BRAINTRUST_API_KEY",
    "BRAINTRUST_PROJECT_ID",
  ]) {
    delete env[name];
  }
  Object.assign(env, extraEnv);
  return env;
}

function runCli(repoRoot: string, args: string[], cwd: string, extraEnv: Record<string, string> = {}) {
  return execFileSync(process.execPath, [
    ...cliProcessArgs(repoRoot, args),
  ], {
    cwd,
    env: buildCliEnv(extraEnv),
    encoding: "utf8",
  });
}

function runCliAsync(repoRoot: string, args: string[], cwd: string, extraEnv: Record<string, string> = {}) {
  return new Promise<string>((resolve, reject) => {
    execFile(process.execPath, cliProcessArgs(repoRoot, args), {
      cwd,
      env: buildCliEnv(extraEnv),
      encoding: "utf8",
    }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }
      resolve(stdout);
    });
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

function listen(server: ReturnType<typeof createServer>) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: ReturnType<typeof createServer>) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function readRequestText(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let text = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      text += chunk;
    });
    request.on("end", () => resolve(text));
    request.on("error", reject);
  });
}

function writeJson(
  response: ServerResponse,
  body: unknown,
  status = 200,
) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
