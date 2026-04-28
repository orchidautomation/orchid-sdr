import { registry } from "../registry.js";
import { getActorClient } from "./actor-client.js";
import { getAppContext } from "./runtime-context.js";
import { runSandboxCompatibilityProbe } from "./sandbox-probe.js";
import {
  createDefaultSdrRuntimeBootstrap,
} from "../../../../packages/default-sdr/src/runtime-bootstrap.js";

const runtimeBootstrap = createDefaultSdrRuntimeBootstrap({
  getContext: getAppContext,
  registry,
  getActorClient,
  runSandboxCompatibilityProbe: async (context) => {
    await runSandboxCompatibilityProbe(context as any);
  },
});

export const ensureRuntimeBootstrapped = runtimeBootstrap.ensureRuntimeBootstrapped;
export const shouldUseRemoteRivetRuntime = runtimeBootstrap.shouldUseRemoteRivetRuntime;
export const shouldSkipLocalRivetRuntime = runtimeBootstrap.shouldSkipLocalRivetRuntime;
