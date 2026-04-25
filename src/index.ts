import { serve } from "@hono/node-server";

import { getConfig } from "./config.js";
import { createApp } from "./server.js";
import { ensureRuntimeBootstrapped } from "./services/runtime-bootstrap.js";

async function main() {
  await ensureRuntimeBootstrapped();
  const config = getConfig();
  const app = createApp();

  serve(
    {
      fetch: app.fetch,
      port: config.PORT,
    },
    (info) => {
      console.log(`orchid-sdr listening on http://localhost:${info.port}`);
    },
  );
}

void main();
