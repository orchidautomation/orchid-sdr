import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function isTrellisAppRoot(candidate: string) {
  return hasAppConfig(candidate)
    && fs.existsSync(path.join(candidate, "knowledge"))
    && fs.existsSync(path.join(candidate, "skills"));
}

function hasAppConfig(candidate: string) {
  const entries = fs.existsSync(candidate) ? fs.readdirSync(candidate) : [];
  return entries.some((entry) => entry.endsWith(".config.ts") || entry.endsWith(".config.js"));
}

function candidateRoots(current: string) {
  return [
    current,
    path.join(current, "examples", "reference-app"),
  ];
}

function findProjectRoot(startDirs: string[]) {
  for (const startDir of startDirs) {
    let current = path.resolve(startDir);

    while (true) {
      for (const candidate of candidateRoots(current)) {
        if (isTrellisAppRoot(candidate)) {
          return candidate;
        }
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

export const projectRoot = findProjectRoot([moduleDir, process.cwd()]);
export const knowledgeRoot = path.join(projectRoot, "knowledge");
export const skillsRoot = path.join(projectRoot, "skills");
export const claudeSkillsRoot = path.join(projectRoot, ".claude", "skills");
