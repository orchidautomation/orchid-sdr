import { createDefaultSdrMcpServer } from "../../../../packages/default-sdr/src/mcp-server.js";
import { resolveMcpExposure } from "../../../../packages/framework/src/index.js";

import type { AppContext } from "../services/runtime-context.js";

export function createTrellisMcpServer(context: AppContext) {
  const exposure = resolveMcpExposure(context.framework.config);
  return createDefaultSdrMcpServer(context, {
    name: "trellis",
    version: "0.1.0",
    tools: exposure,
  });
}
