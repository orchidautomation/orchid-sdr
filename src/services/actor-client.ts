import { createClient } from "rivetkit/client";

import { getConfig } from "../config.js";
import { registry } from "../registry.js";

let cachedClient: ReturnType<typeof createClient<typeof registry>> | null = null;

export function getActorClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = registry.parseConfig();
  cachedClient = createClient<typeof registry>({
    endpoint: `http://127.0.0.1:${config.managerPort}`,
    disableMetadataLookup: true,
  });

  return cachedClient;
}
