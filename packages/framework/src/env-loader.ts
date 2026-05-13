import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let loadedForCwd = new Set<string>();

export function loadProcessEnvFiles(input?: {
  cwd?: string;
  files?: string[];
}) {
  const cwd = input?.cwd ?? process.cwd();
  const files = input?.files ?? defaultEnvFiles();
  const cacheKey = `${cwd}::${files.join(",")}`;

  if (loadedForCwd.has(cacheKey)) {
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

  loadedForCwd.add(cacheKey);
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
