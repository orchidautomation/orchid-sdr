import { createClient } from "rivetkit/client";

import { getConfig } from "../config.js";
import { registry } from "../registry.js";

type TrellisActorClient = ReturnType<typeof createClient<typeof registry>> & {
  sourceIngest: {
    getOrCreate(): any;
  };
  prospectThread: {
    getOrCreate(key?: unknown): any;
  };
  campaignOps: {
    getOrCreate(key?: unknown): any;
  };
  sandboxBroker: {
    getOrCreate(key?: unknown): any;
  };
  discoveryCoordinator: {
    getOrCreate(key: [string, "linkedin_public_post" | "x_public_post"]): any;
  };
};

let cachedClient: TrellisActorClient | null = null;

export function getActorClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = registry.parseConfig();
  if (process.env.VERCEL && !config.endpoint) {
    throw new Error(
      "RIVET_ENDPOINT is required when trellis runs on Vercel. Connect the Vercel deployment in Rivet and set RIVET_ENDPOINT/RIVET_PUBLIC_ENDPOINT.",
    );
  }

  cachedClient = createClient<typeof registry>({
    endpoint: config.endpoint ?? `http://127.0.0.1:${config.managerPort}`,
    token: config.token,
    namespace: config.namespace,
    disableMetadataLookup: true,
  }) as TrellisActorClient;

  return cachedClient;
}
