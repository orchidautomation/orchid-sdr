import { Pool } from "pg";

import { getConfig } from "../config.js";

let pool: Pool | null = null;

export function getDb() {
  if (!pool) {
    const databaseUrl = getConfig().DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required when the SQL repository is enabled.");
    }

    pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  return pool;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
