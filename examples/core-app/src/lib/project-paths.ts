import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function hasAppConfig(candidate: string) {
  const entries = fs.existsSync(candidate) ? fs.readdirSync(candidate) : [];
  return entries.some((entry) => entry.endsWith(".config.ts") || entry.endsWith(".config.js"));
}

function isProjectRoot(candidate: string) {
  return hasAppConfig(candidate)
    && fs.existsSync(path.join(candidate, "knowledge"))
    && fs.existsSync(path.join(candidate, "skills"));
}

function findProjectRoot(startDirs: string[]) {
  for (const startDir of startDirs) {
    let current = path.resolve(startDir);
    while (true) {
      if (isProjectRoot(current)) {
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

export const projectRoot = findProjectRoot([moduleDir, process.cwd()]);
export const knowledgeRoot = path.join(projectRoot, "knowledge");
export const skillsRoot = path.join(projectRoot, "skills");
export const claudeSkillsRoot = path.join(projectRoot, ".claude", "skills");

