import { migrateDatabase } from "../db/migrate.js";
import { registry } from "../registry.js";
import { OrchidRepository } from "../repository.js";
import { getActorClient } from "./actor-client.js";
import { getAppContext } from "./runtime-context.js";
import { runSandboxCompatibilityProbe } from "./sandbox-probe.js";

let bootstrapPromise: Promise<void> | null = null;

export async function ensureRuntimeBootstrapped() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    const context = getAppContext();
    if (context.repository instanceof OrchidRepository) {
      await migrateDatabase();
    }
    await context.repository.ensureDefaultCampaign();

    if (context.config.NO_SENDS_MODE !== undefined) {
      await context.repository.setControlFlag("no_sends_mode", {
        enabled: context.config.NO_SENDS_MODE,
      });
    }

    if (context.config.SANDBOX_COMPAT_PROBE_ON_STARTUP) {
      await runNonFatalBootstrapTask("sandbox compatibility probe", async () => {
        await runSandboxCompatibilityProbe(context);
      });
    }

    if (shouldSkipLocalRivetRuntime()) {
      console.warn(
        "Skipping local Rivet runtime bootstrap on Vercel because RIVET_ENDPOINT is not configured.",
      );
      return;
    }

    if (!shouldUseRemoteRivetRuntime()) {
      registry.start();
    }

    await runNonFatalBootstrapTask("discovery actor bootstrap", bootstrapDiscoveryActors);
  })().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });

  return bootstrapPromise;
}

export function shouldUseRemoteRivetRuntime() {
  return Boolean(registry.parseConfig().endpoint);
}

export function shouldSkipLocalRivetRuntime() {
  return Boolean(process.env.VERCEL) && !shouldUseRemoteRivetRuntime();
}

async function runNonFatalBootstrapTask(label: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error(`Non-fatal runtime bootstrap failure: ${label}`, error);
  }
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
