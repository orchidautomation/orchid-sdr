import {
  createBootstrapRunner,
  hasRemoteRuntimeEndpoint,
  runNonFatalBootstrapTask,
  shouldSkipLocalRuntimeOnVercel,
} from "@ai-sdr/framework/runtime-bootstrap";

export interface DefaultSdrBootstrapContext {
  config: {
    NO_SENDS_MODE?: boolean;
    SANDBOX_COMPAT_PROBE_ON_STARTUP: boolean;
    DISCOVERY_LINKEDIN_ENABLED: boolean;
    DISCOVERY_X_ENABLED: boolean;
  };
  localSmokeMode: boolean;
  repository: {
    ensureDefaultCampaign(): Promise<{ id: string }>;
    setControlFlag(name: string, value: Record<string, unknown>): Promise<void>;
  };
}

export interface DefaultSdrRegistryLike {
  start(): void;
  parseConfig(): {
    endpoint?: string | null;
  };
}

export interface DefaultSdrActorClientLike {
  discoveryCoordinator: {
    getOrCreate(key: [string, "linkedin_public_post" | "x_public_post"]): any;
  };
}

export function createDefaultSdrRuntimeBootstrap(input: {
  getContext(): DefaultSdrBootstrapContext;
  registry: DefaultSdrRegistryLike;
  getActorClient(): DefaultSdrActorClientLike;
  runSandboxCompatibilityProbe?(context: DefaultSdrBootstrapContext): Promise<void>;
}) {
  const ensureRuntimeBootstrapped = createBootstrapRunner(async () => {
    const context = input.getContext();
    await context.repository.ensureDefaultCampaign();

    if (context.config.NO_SENDS_MODE !== undefined) {
      await context.repository.setControlFlag("no_sends_mode", {
        enabled: context.config.NO_SENDS_MODE,
      });
    }

    if (context.config.SANDBOX_COMPAT_PROBE_ON_STARTUP && input.runSandboxCompatibilityProbe) {
      await runNonFatalBootstrapTask("sandbox compatibility probe", async () => {
        await input.runSandboxCompatibilityProbe?.(context);
      });
    }

    if (shouldSkipLocalRivetRuntime()) {
      console.warn(
        "Skipping local Rivet runtime bootstrap on Vercel because RIVET_ENDPOINT is not configured.",
      );
      return;
    }

    if (!shouldUseRemoteRivetRuntime()) {
      input.registry.start();
    }

    if (context.localSmokeMode) {
      console.warn("Local smoke mode enabled: using in-memory repository/state fallbacks and skipping discovery actor bootstrap.");
      return;
    }

    await runNonFatalBootstrapTask("discovery actor bootstrap", bootstrapDiscoveryActors);
  });

  function shouldUseRemoteRivetRuntime() {
    return hasRemoteRuntimeEndpoint(input.registry.parseConfig().endpoint);
  }

  function shouldSkipLocalRivetRuntime() {
    return shouldSkipLocalRuntimeOnVercel({
      isVercel: Boolean(process.env.VERCEL),
      remoteEndpoint: input.registry.parseConfig().endpoint,
    });
  }

  async function bootstrapDiscoveryActors() {
    const context = input.getContext();
    const campaign = await context.repository.ensureDefaultCampaign();
    const client = input.getActorClient();

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

  return {
    ensureRuntimeBootstrapped,
    shouldUseRemoteRivetRuntime,
    shouldSkipLocalRivetRuntime,
  };
}
