import { parseArgs } from "node:util";

import { createClient } from "rivetkit/client";

import { registry } from "../src/registry.js";

const args = parseArgs({
  options: {
    endpoint: {
      type: "string",
    },
    source: {
      type: "string",
      default: "linkedin_public_post",
    },
    campaign: {
      type: "string",
      default: "cmp_default",
    },
    reason: {
      type: "string",
      default: "manual_script",
    },
  },
});

const endpoint = args.values.endpoint ?? process.env.RIVET_CLIENT_ENDPOINT ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}/api/rivet`;
const source = args.values.source as "linkedin_public_post" | "x_public_post";
const campaignId = args.values.campaign;
const reason = args.values.reason;

async function main() {
  const client = createClient<typeof registry>({
    endpoint,
    disableMetadataLookup: true,
  });

  const actor = client.discoveryCoordinator.getOrCreate([campaignId, source]);
  const result = await actor.enqueueTick({ reason });
  const snapshot = await actor.getSnapshot();

  console.log(
    JSON.stringify(
      {
        endpoint,
        result,
        latestRun: snapshot.runs[0] ?? null,
        state: snapshot.state,
      },
      null,
      2,
    ),
  );
}

void main();
