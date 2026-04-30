import { parseArgs } from "node:util";
import { ConvexHttpClient } from "convex/browser";

import { loadProcessEnvFiles } from "@ai-sdr/framework";
import { convexMutations, convexQueries } from "../../../packages/default-sdr/src/convex-repository.js";

loadProcessEnvFiles();

function assertEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const args = parseArgs({
    options: {
      limit: { type: "string" },
      "stale-minutes": { type: "string" },
      apply: { type: "boolean", default: false },
      "pause-reason": { type: "string" },
    },
  });

  const client = new ConvexHttpClient(assertEnv("CONVEX_URL"));
  const limit = Number(args.values.limit ?? "50");
  const staleMinutes = Number(args.values["stale-minutes"] ?? "90");
  const apply = Boolean(args.values.apply);
  const pauseReason = args.values["pause-reason"] ?? "stale capture_signal cleanup";

  const audit = await client.query(convexQueries.auditDataQuality, {
    limit,
    staleMinutes,
  });

  console.log("Data quality audit:");
  console.log(JSON.stringify(audit, null, 2));

  if (!apply) {
    console.log("");
    console.log("Dry run only. Re-run with --apply to normalize noisy titles and pause stale capture_signal rows.");
    return;
  }

  const cleanup = await client.mutation(convexMutations.cleanupDataQuality, {
    limit,
    staleMinutes,
    pauseReason,
    dryRun: false,
  });

  console.log("");
  console.log("Applied cleanup:");
  console.log(JSON.stringify(cleanup, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
