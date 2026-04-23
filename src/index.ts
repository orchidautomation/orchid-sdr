import { serve } from "@hono/node-server";

import { getConfig } from "./config.js";
import { migrateDatabase } from "./db/migrate.js";
import { registry } from "./registry.js";
import { createApp } from "./server.js";
import { getActorClient } from "./services/actor-client.js";
import { getAppContext } from "./services/runtime-context.js";
import { runSandboxCompatibilityProbe } from "./services/sandbox-probe.js";

async function main() {
  await migrateDatabase();

  const config = getConfig();
  const context = getAppContext();
  await context.repository.ensureDefaultCampaign();

  if (config.NO_SENDS_MODE !== undefined) {
    await context.repository.setControlFlag("no_sends_mode", {
      enabled: config.NO_SENDS_MODE,
    });
  }

  if (config.SANDBOX_COMPAT_PROBE_ON_STARTUP) {
    await runSandboxCompatibilityProbe(context);
  }

  registry.start();
  const app = await createApp();

  serve(
    {
      fetch: app.fetch,
      port: config.PORT,
    },
    (info) => {
      console.log(`orchid-sdr listening on http://localhost:${info.port}`);
      void bootstrapDiscoveryActors().catch((error) => {
        console.error("failed to bootstrap discovery actors", error);
      });
    },
  );
}

async function bootstrapDiscoveryActors() {
  const context = getAppContext();
  const campaign = await context.repository.ensureDefaultCampaign();
  const client = getActorClient();

  if (context.config.DISCOVERY_LINKEDIN_ENABLED) {
    const actor = client.discoveryCoordinator.getOrCreate([campaign.id, "linkedin_public_post"]);
    await actor.initialize({
      campaignId: campaign.id,
      source: "linkedin_public_post",
      runNow: false,
    });
    await actor.enqueueTick({
      reason: "startup_bootstrap",
    });
  }

  if (context.config.DISCOVERY_X_ENABLED) {
    const actor = client.discoveryCoordinator.getOrCreate([campaign.id, "x_public_post"]);
    await actor.initialize({
      campaignId: campaign.id,
      source: "x_public_post",
      runNow: false,
    });
    await actor.enqueueTick({
      reason: "startup_bootstrap",
    });
  }
}

void main();
