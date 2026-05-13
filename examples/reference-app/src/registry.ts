import { createDefaultSdrRegistry } from "../../../packages/default-sdr/src/actor-registry.js";

import { createId } from "./lib/ids.js";
import { discoveryCoordinator } from "./orchestration/discovery-coordinator.js";
import { runSandboxTurn } from "./orchestration/sandbox-broker.js";
import { executeProspectWorkflow, processInboundReply } from "./orchestration/prospect-workflow.js";
import { ingestApifyRun } from "./orchestration/source-ingest.js";
import { getAppContext, type AppContext } from "./services/runtime-context.js";

export const registry = createDefaultSdrRegistry<AppContext>({
  getContext: getAppContext,
  createId,
  discoveryCoordinator,
  ingestApifyRun: ingestApifyRun as any,
  executeProspectWorkflow: executeProspectWorkflow as any,
  processInboundReply: processInboundReply as any,
  runSandboxTurn: runSandboxTurn as any,
  managerHost: "127.0.0.1",
  managerPort: 6420,
});
