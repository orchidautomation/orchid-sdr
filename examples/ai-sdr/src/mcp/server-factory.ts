import { z } from "zod";
import { createDefaultSdrMcpServer } from "../../../../packages/default-sdr/src/mcp-server.js";
import { resolveMcpExposure } from "../../../../packages/framework/src/index.js";

import type { AppContext } from "../services/runtime-context.js";

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

export function createTrellisMcpServer(context: AppContext) {
  const exposure = resolveMcpExposure(context.framework.config);
  const server = createDefaultSdrMcpServer(context, {
    name: "trellis",
    version: "0.1.0",
    tools: exposure,
  });

  server.registerTool(
    "example.closedWonLookalike",
    {
      description: "Load the closed-won lookalike outbound example and optional live runtime guidance.",
      inputSchema: {
        includeRuntime: z.boolean().optional(),
      },
    },
    async ({ includeRuntime }) =>
      toToolResult(await context.mcpTools.handleTool("example.closedWonLookalike", { includeRuntime })),
  );

  server.registerTool(
    "ocean.searchCompanies",
    {
      description: "Search lookalike companies through the first-party Ocean adapter.",
      inputSchema: {
        size: z.number().int().min(1).max(10000).optional(),
        searchAfter: z.string().optional(),
        lookalikeDomains: z.array(z.string()).optional(),
        companyMatchingMode: z.enum(["precise", "broad"]).optional(),
        companiesFilters: z.record(z.string(), z.unknown()).optional(),
        peopleFilters: z.record(z.string(), z.unknown()).optional(),
        fields: z.array(z.string()).optional(),
      },
    },
    async (args) => toToolResult(await context.mcpTools.handleTool("ocean.searchCompanies", args as Record<string, unknown>)),
  );

  server.registerTool(
    "ocean.searchPeople",
    {
      description: "Search lookalike people through the first-party Ocean adapter.",
      inputSchema: {
        size: z.number().int().min(1).max(10000).optional(),
        searchAfter: z.string().optional(),
        peoplePerCompany: z.number().int().min(1).optional(),
        jobTitleThreshold: z.number().min(0).max(1).optional(),
        peopleFilters: z.record(z.string(), z.unknown()).optional(),
        companiesFilters: z.record(z.string(), z.unknown()).optional(),
        fields: z.array(z.string()).optional(),
      },
    },
    async (args) => toToolResult(await context.mcpTools.handleTool("ocean.searchPeople", args as Record<string, unknown>)),
  );

  server.registerTool(
    "ocean.enrichCompany",
    {
      description: "Enrich one company through the first-party Ocean adapter.",
      inputSchema: {
        company: z.record(z.string(), z.unknown()),
        fields: z.array(z.string()).optional(),
      },
    },
    async (args) => toToolResult(await context.mcpTools.handleTool("ocean.enrichCompany", args as Record<string, unknown>)),
  );

  return server;
}
