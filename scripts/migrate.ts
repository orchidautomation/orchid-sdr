import { migrateDatabase } from "../src/db/migrate.js";

await migrateDatabase();
console.log("database migration complete");
