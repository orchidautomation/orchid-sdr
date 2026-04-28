import { registry } from "../registry.js";
import { getActorClient } from "./actor-client.js";
import { getAppContext } from "./runtime-context.js";
import { runSandboxCompatibilityProbe } from "./sandbox-probe.js";
import {
  createBootstrapRunner,
  hasRemoteRuntimeEndpoint,
  runNonFatalBootstrapTask,
  shouldSkipLocalRuntimeOnVercel,
} from "@ai-sdr/framework/runtime-bootstrap";

export const ensureRuntimeBootstrapped = createBootstrapRunner(async () => {
    const context = getAppContext();
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

    if (context.localSmokeMode) {
      console.warn("Local smoke mode enabled: using in-memory repository/state fallbacks and skipping discovery actor bootstrap.");
      return;
    }

    await runNonFatalBootstrapTask("discovery actor bootstrap", bootstrapDiscoveryActors);
});

export function shouldUseRemoteRivetRuntime() {
  return hasRemoteRuntimeEndpoint(registry.parseConfig().endpoint);
}

export function shouldSkipLocalRivetRuntime() {
  return shouldSkipLocalRuntimeOnVercel({
    isVercel: Boolean(process.env.VERCEL),
    remoteEndpoint: registry.parseConfig().endpoint,
  });
}

async function bootstrapDiscoveryActors() {
  const context = getAppContext();
  const campaign = await context.repository.ensureDefaultCampaign();
  const client = getActorClient();

  if (context.config.DISCOVERY_LINKEDIN_ENABLED) {
    const actor = client.discoveryCoordinator.getOrCreate([campaign.id, "linkedin_public_post"]) as any;
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
    const actor = client.discoveryCoordinator.getOrCreate([campaign.id, "x_public_post"]) as any;
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
