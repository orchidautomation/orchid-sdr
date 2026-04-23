import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createOrchidMcpServer } from "./server-factory.js";
import { getAppContext } from "../services/runtime-context.js";

async function main() {
  const server = createOrchidMcpServer(getAppContext());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main();
