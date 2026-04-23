import { Pool } from "pg";

import { getConfig } from "../config.js";

let pool: Pool | null = null;

export function getDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: getConfig().DATABASE_URL,
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
