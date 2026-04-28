import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createTrellisMcpServer } from "./server-factory.js";
import { getAppContext } from "../services/runtime-context.js";

async function main() {
  const server = createTrellisMcpServer(getAppContext());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main();
