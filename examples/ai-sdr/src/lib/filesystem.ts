import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

export interface TextFileEntry {
  absolutePath: string;
  relativePath: string;
  content: string;
}

export async function loadTextFiles(root: string): Promise<TextFileEntry[]> {
  const entries = await walk(root);
  return Promise.all(
    entries.map(async (absolutePath) => ({
      absolutePath,
      relativePath: path.relative(root, absolutePath),
      content: await readFile(absolutePath, "utf8"),
    })),
  );
}

export async function pathExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(root: string): Promise<string[]> {
  const dirEntries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of dirEntries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}
