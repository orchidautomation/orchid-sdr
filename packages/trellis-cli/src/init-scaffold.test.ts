import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("trellis init v3 scaffold", () => {
  it("keeps default help focused on the v3 happy path", () => {
    const repoRoot = process.cwd();
    const cliPath = path.join(repoRoot, "packages", "trellis-cli", "src", "cli.ts");
    const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

    const output = execFileSync(process.execPath, [
      tsxCli,
      cliPath,
      "help",
    ], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("npm run trellis -- init <target-dir> [--name my-app]");
    expect(output).toContain("Cloudflare is the default deploy target.");
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
    const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

    try {
      const output = execFileSync(process.execPath, [
        tsxCli,
        cliPath,
        "init",
        targetDir,
        "--name",
        "test-sdr",
        "--json",
      ], {
        cwd: repoRoot,
        encoding: "utf8",
      });

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
});
