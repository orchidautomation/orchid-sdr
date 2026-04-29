import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function isAiSdrRoot(candidate: string) {
  return fs.existsSync(path.join(candidate, "ai-sdr.config.ts"))
    && fs.existsSync(path.join(candidate, "knowledge"))
    && fs.existsSync(path.join(candidate, "skills"));
}

function candidateRoots(current: string) {
  return [
    current,
    path.join(current, "examples", "ai-sdr"),
  ];
}

function findProjectRoot(startDirs: string[]) {
  for (const startDir of startDirs) {
    let current = path.resolve(startDir);

    while (true) {
      for (const candidate of candidateRoots(current)) {
        if (isAiSdrRoot(candidate)) {
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
