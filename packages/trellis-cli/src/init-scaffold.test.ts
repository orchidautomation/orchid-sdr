import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("trellis init v3 scaffold", () => {
  it("emits a standalone-installable local development scaffold", () => {
    const repoRoot = process.cwd();
    const targetDir = mkdtempSync(path.join(tmpdir(), "trellis-init-test."));
    const cliPath = path.join(repoRoot, "packages", "trellis-cli", "src", "cli.ts");
    const tsxCli = path.join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");

    try {
      execFileSync(process.execPath, [
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

      const generatedPackage = JSON.parse(readFileSync(path.join(targetDir, "package.json"), "utf8")) as {
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      const dependencySpecs = [
        ...Object.values(generatedPackage.dependencies),
        ...Object.values(generatedPackage.devDependencies),
      ];

      expect(dependencySpecs).not.toContain("workspace:*");
      expect(generatedPackage.dependencies["@trellis/gtm"]).toMatch(/^file:\/\//);
      expect(generatedPackage.dependencies["@trellis/providers"]).toMatch(/^file:\/\//);
      expect(generatedPackage.devDependencies["@trellis/cli"]).toMatch(/^file:\/\//);
      expect(generatedPackage.devDependencies.tsx).toBeDefined();
      expect(readFileSync(cliPath, "utf8")).toMatch(/^#!\/usr\/bin\/env tsx/);
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });
});
