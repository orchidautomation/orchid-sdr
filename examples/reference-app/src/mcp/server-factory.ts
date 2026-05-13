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
    "crm.getList",
    {
      description: "Get one CRM list plus its writable/readable attributes through the configured provider.",
      inputSchema: {
        listId: z.string(),
        includeAttributes: z.boolean().optional(),
      },
    },
    async ({ listId, includeAttributes }) =>
      toToolResult(await context.mcpTools.handleTool("crm.getList", { listId, includeAttributes })),
  );

  server.registerTool(
    "crm.listEntries",
    {
      description: "Read CRM list entries and optionally hydrate the parent records behind those entries.",
      inputSchema: {
        listId: z.string(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
        includeRecords: z.boolean().optional(),
      },
    },
    async ({ listId, limit, offset, includeRecords }) =>
      toToolResult(await context.mcpTools.handleTool("crm.listEntries", { listId, limit, offset, includeRecords })),
  );

  server.registerTool(
    "crm.getRecord",
    {
      description: "Get one CRM record and optionally inspect the CRM lists it currently belongs to.",
      inputSchema: {
        object: z.string(),
        recordId: z.string(),
        includeListEntries: z.boolean().optional(),
      },
    },
    async ({ object, recordId, includeListEntries }) =>
      toToolResult(await context.mcpTools.handleTool("crm.getRecord", { object, recordId, includeListEntries })),
  );

  server.registerTool(
    "crm.queryCompanies",
    {
      description: "Query CRM company/account records by domain or exact name.",
      inputSchema: {
        domain: z.string().optional(),
        name: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        includeListEntries: z.boolean().optional(),
      },
    },
    async ({ domain, name, limit, includeListEntries }) =>
      toToolResult(await context.mcpTools.handleTool("crm.queryCompanies", { domain, name, limit, includeListEntries })),
  );

  server.registerTool(
    "crm.queryPeople",
    {
      description: "Query CRM people/contact records by email, LinkedIn, Twitter/X, or name plus company context.",
      inputSchema: {
        email: z.string().optional(),
        linkedinUrl: z.string().optional(),
        twitterUrl: z.string().optional(),
        fullName: z.string().optional(),
        companyRecordId: z.string().optional(),
        companyDomain: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
        includeListEntries: z.boolean().optional(),
      },
    },
    async ({ email, linkedinUrl, twitterUrl, fullName, companyRecordId, companyDomain, limit, includeListEntries }) =>
      toToolResult(
        await context.mcpTools.handleTool("crm.queryPeople", {
          email,
          linkedinUrl,
          twitterUrl,
          fullName,
          companyRecordId,
          companyDomain,
          limit,
          includeListEntries,
        }),
      ),
  );

  server.registerTool(
    "crm.queryProcesses",
    {
      description: "Inspect CRM and Trellis process-state memberships that could block or influence a new workflow write.",
      inputSchema: {
        companyRecordIds: z.array(z.string()).optional(),
        personRecordIds: z.array(z.string()).optional(),
        targetListId: z.string().optional(),
        activeListIds: z.array(z.string()).optional(),
      },
    },
    async ({ companyRecordIds, personRecordIds, targetListId, activeListIds }) =>
      toToolResult(
        await context.mcpTools.handleTool("crm.queryProcesses", {
          companyRecordIds,
          personRecordIds,
          targetListId,
          activeListIds,
        }),
      ),
  );

  server.registerTool(
    "crm.dedupeProspect",
    {
      description: "Check CRM company/contact matches and list memberships before writing a prospect back into the CRM.",
      inputSchema: {
        companyDomain: z.string().optional(),
        companyName: z.string().optional(),
        email: z.string().optional(),
        linkedinUrl: z.string().optional(),
        twitterUrl: z.string().optional(),
        fullName: z.string().optional(),
        targetListId: z.string().optional(),
        activeListIds: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(25).optional(),
      },
    },
    async ({ companyDomain, companyName, email, linkedinUrl, twitterUrl, fullName, targetListId, activeListIds, limit }) =>
      toToolResult(
        await context.mcpTools.handleTool("crm.dedupeProspect", {
          companyDomain,
          companyName,
          email,
          linkedinUrl,
          twitterUrl,
          fullName,
          targetListId,
          activeListIds,
          limit,
        }),
      ),
  );

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
