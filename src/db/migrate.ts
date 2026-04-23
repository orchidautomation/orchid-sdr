import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDb } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrateDatabase() {
  const migrationDir = await resolveMigrationDirectory();
  const migrationFiles = (await readdir(migrationDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  const db = getDb();

  for (const fileName of migrationFiles) {
    const sql = await readFile(path.join(migrationDir, fileName), "utf8");
    await db.query(sql);
  }
}

async function resolveMigrationDirectory() {
  const candidates = [
    path.join(__dirname, "migrations"),
    path.join(__dirname, "..", "src", "db", "migrations"),
    path.join(process.cwd(), "dist", "migrations"),
    path.join(process.cwd(), "src", "db", "migrations"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("migration directory not found in any expected location");
}
