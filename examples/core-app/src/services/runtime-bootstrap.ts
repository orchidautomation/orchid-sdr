import {
  createBootstrapRunner,
  hasRemoteRuntimeEndpoint,
  runNonFatalBootstrapTask,
  shouldSkipLocalRuntimeOnVercel,
} from "@trellis/framework/runtime-bootstrap";

import { registry } from "../registry.js";
import { getActorClient } from "./actor-client.js";
import { getAppContext } from "./runtime-context.js";
import { runSandboxCompatibilityProbe } from "./sandbox-probe.js";

const ensureRuntimeBootstrapped = createBootstrapRunner(async () => {
  const context = getAppContext();
  await context.repository.ensureWorkspace();

  if (context.config.SANDBOX_COMPAT_PROBE_ON_STARTUP) {
    await runNonFatalBootstrapTask("sandbox compatibility probe", async () => {
      await runSandboxCompatibilityProbe(context);
    });
  }

  if (shouldSkipLocalRivetRuntime()) {
    return;
  }

  if (!shouldUseRemoteRivetRuntime()) {
    registry.start();
  } else {
    await runNonFatalBootstrapTask("runtime bootstrap", async () => {
      getActorClient();
    });
  }
});

export { ensureRuntimeBootstrapped };

export function shouldUseRemoteRivetRuntime() {
  return hasRemoteRuntimeEndpoint(registry.parseConfig().endpoint);
}

export function shouldSkipLocalRivetRuntime() {
  return shouldSkipLocalRuntimeOnVercel({
    isVercel: Boolean(process.env.VERCEL),
    remoteEndpoint: registry.parseConfig().endpoint,
  });
}

