import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defaultSdrMcpToolCatalog } from "./mcp-tool-catalog.js";

interface McpToolHandler {
  handleTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface DefaultSdrMcpContext {
  mcpTools: McpToolHandler;
}

function toToolResult(result: unknown) {
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  const structuredContent =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : { result };
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    structuredContent,
  };
}

function registerTool(
  server: McpServer,
  context: DefaultSdrMcpContext,
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>,
) {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
    },
    async (args) => toToolResult(await context.mcpTools.handleTool(name, args as Record<string, unknown>)),
  );
}

export function createDefaultSdrMcpServer(
  context: DefaultSdrMcpContext,
  input?: {
    name?: string;
    version?: string;
  },
) {
  const server = new McpServer({
    name: input?.name ?? "trellis",
    version: input?.version ?? "0.1.0",
  });

  for (const tool of defaultSdrMcpToolCatalog) {
    registerTool(server, context, tool.name, tool.description, tool.inputSchema);
  }

  return server;
}
