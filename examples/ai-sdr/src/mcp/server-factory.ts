import { createDefaultSdrMcpServer } from "../../../../packages/default-sdr/src/mcp-server.js";

import type { AppContext } from "../services/runtime-context.js";

export function createTrellisMcpServer(context: AppContext) {
  return createDefaultSdrMcpServer(context, {
    name: "trellis",
    version: "0.1.0",
  });
}
