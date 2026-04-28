import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function findProjectRoot(startDirs: string[]) {
  for (const startDir of startDirs) {
    let current = path.resolve(startDir);

    while (true) {
      if (fs.existsSync(path.join(current, "ai-sdr.config.ts"))) {
        return current;
      }

      if (fs.existsSync(path.join(current, "package.json"))) {
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
