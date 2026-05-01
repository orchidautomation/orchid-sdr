import { createClient } from "rivetkit/client";

import { getConfig } from "../config.js";
import { registry } from "../registry.js";

type TrellisActorClient = ReturnType<typeof createClient<typeof registry>> & {
  workItemThread: {
    getOrCreate(key: [string]): any;
  };
  sandboxBroker: {
    getOrCreate(key?: unknown): any;
  };
};

let cachedClient: TrellisActorClient | null = null;

export function getActorClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const runtimeConfig = registry.parseConfig();
  if (process.env.VERCEL && !runtimeConfig.endpoint) {
    throw new Error(
      "RIVET_ENDPOINT is required when trellis runs on Vercel. Connect the Vercel deployment in Rivet and set RIVET_ENDPOINT/RIVET_PUBLIC_ENDPOINT.",
    );
  }

  cachedClient = createClient<typeof registry>({
    endpoint: runtimeConfig.endpoint ?? `http://127.0.0.1:${runtimeConfig.managerPort}`,
    token: runtimeConfig.token,
    namespace: runtimeConfig.namespace,
    disableMetadataLookup: true,
  }) as TrellisActorClient;

  return cachedClient;
}
