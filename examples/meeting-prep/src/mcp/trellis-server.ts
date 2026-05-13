import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { getAppContext } from "../services/runtime-context.js";
import { createTrellisMcpServer } from "./server-factory.js";

async function main() {
  const server = createTrellisMcpServer(getAppContext());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main();

