import { module, type AiSdrModuleDefinition } from "./index.js";
import {
  agentMailProvider,
  apifyLinkedInProvider,
  attioProvider,
  convexProvider,
  firecrawlProvider,
  neonProvider,
  normalizedWebhookProvider,
  orchidMcpProvider,
  parallelProvider,
  prospeoProvider,
  rivetProvider,
  slackHandoffProvider,
  vercelAiGatewayProvider,
  vercelSandboxProvider,
} from "./providers.js";

export function attioModule(): AiSdrModuleDefinition {
  return module({
    id: "attio",
    displayName: "Attio CRM",
    packageName: "@ai-sdr/attio",
    description: "Sync qualified prospects into Attio and promote list stages on reply events.",
    providerKey: "attio",
    capabilityIds: ["crm"],
    contracts: ["crm.prospectSync.v1", "crm.stageUpdate.v1"],
    providers: [attioProvider()],
    docs: [
      {
        label: "Attio setup",
        path: "docs/self-hosting.md",
      },
    ],
    smokeChecks: [
      {
        id: "crm.syncProspect",
        description: "Sync one reviewed prospect and verify company, person, list entry, and stored Attio IDs.",
      },
    ],
  });
}

export function agentMailModule(): AiSdrModuleDefinition {
  return module({
    id: "agentmail",
    displayName: "AgentMail",
    packageName: "@ai-sdr/agentmail",
    description: "Provide agent-native outbound email, sender inboxes, reply fetching, and inbound webhooks.",
    providerKey: "agentmail",
    capabilityIds: ["email"],
    contracts: ["email.outbound.v1", "email.inbound.v1"],
    providers: [agentMailProvider()],
    docs: [
      {
        label: "Email and replies setup",
        path: "docs/self-hosting.md",
      },
      {
        label: "Email provider guidance",
        path: "docs/email-providers.md",
      },
    ],
    smokeChecks: [
      {
        id: "mail.preview",
        description: "Generate one approved preview before enabling real sends.",
      },
      {
        id: "webhooks.agentmail",
        description: "Send a real reply into the webhook and confirm reply classification.",
      },
    ],
  });
}

export function apifyLinkedInModule(): AiSdrModuleDefinition {
  return module({
    id: "apify-linkedin",
    displayName: "Apify LinkedIn public-post discovery",
    packageName: "@ai-sdr/apify-linkedin",
    description: "Discover LinkedIn public posts and normalize them into SDR signals.",
    providerKey: "apify",
    capabilityIds: ["source"],
    contracts: ["signal.discovery.v1", "signal.normalized.v1"],
    providers: [apifyLinkedInProvider()],
    docs: [
      {
        label: "Discovery setup",
        path: "docs/self-hosting.md",
      },
    ],
    smokeChecks: [
      {
        id: "runtime.discoveryHealth",
        description: "Confirm discovery source health after a real or manual run.",
      },
    ],
  });
}

export function normalizedWebhookModule(): AiSdrModuleDefinition {
  return module({
    id: "normalized-webhook",
    displayName: "Normalized signal webhook",
    packageName: "@ai-sdr/webhooks",
    description: "Accept warm leads and custom source signals through a normalized webhook contract.",
    providerKey: "webhook",
    capabilityIds: ["source"],
    contracts: ["signal.webhook.v1", "signal.normalized.v1"],
    providers: [normalizedWebhookProvider()],
    docs: [
      {
        label: "Normalized signal contract",
        path: "docs/reference.md",
      },
    ],
    smokeChecks: [
      {
        id: "webhooks.signals",
        description: "Post one normalized signal and inspect the resulting lead.",
      },
    ],
  });
}

export function firecrawlModule(): AiSdrModuleDefinition {
  return module({
    id: "firecrawl",
    displayName: "Firecrawl research",
    packageName: "@ai-sdr/firecrawl",
    description: "Primary search and extraction surface for open-web research, crawling, and browser-backed page interaction.",
    providerKey: "firecrawl",
    capabilityIds: ["source", "search", "extract", "enrichment", "runtime", "observability"],
    contracts: ["research.search.v1", "research.extract.v1"],
    providers: [firecrawlProvider()],
    mcpServers: [
      {
        id: "firecrawl",
        displayName: "Firecrawl MCP",
        providerKey: "firecrawl",
        transport: "http",
        url: "https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp",
        auth: "url-token",
        requiredEnv: [
          { name: "FIRECRAWL_API_KEY", description: "Firecrawl API key embedded in the hosted MCP URL." },
        ],
        tools: [
          {
            name: "firecrawl_scrape",
            description: "Scrape one URL into clean structured data.",
            capabilityIds: ["extract"],
            contracts: ["research.extract.v1"],
          },
          {
            name: "firecrawl_map",
            description: "Map/discover URLs on a site.",
            capabilityIds: ["source"],
            contracts: ["signal.discovery.v1"],
          },
          {
            name: "firecrawl_search",
            description: "Search the web and return page content.",
            capabilityIds: ["search", "extract"],
            contracts: ["research.search.v1", "research.extract.v1"],
          },
          {
            name: "firecrawl_crawl",
            description: "Crawl a site across multiple pages.",
            capabilityIds: ["source", "extract"],
            contracts: ["signal.discovery.v1", "research.extract.v1"],
          },
          {
            name: "firecrawl_check_crawl_status",
            description: "Check crawl job status.",
            capabilityIds: ["observability"],
          },
          {
            name: "firecrawl_extract",
            description: "Extract structured data from one or more URLs.",
            capabilityIds: ["extract", "enrichment"],
            contracts: ["research.extract.v1", "research.enrich.v1"],
          },
          {
            name: "firecrawl_agent",
            description: "Run autonomous web research and extraction.",
            capabilityIds: ["search", "extract", "enrichment"],
            contracts: ["research.search.v1", "research.extract.v1", "research.enrich.v1"],
          },
          {
            name: "firecrawl_agent_status",
            description: "Check autonomous agent job status.",
            capabilityIds: ["observability"],
          },
          {
            name: "firecrawl_browser_create",
            description: "Create a browser session for interactive workflows.",
            capabilityIds: ["runtime"],
          },
          {
            name: "firecrawl_browser_execute",
            description: "Execute bash, Python, or JavaScript inside a browser session.",
            capabilityIds: ["runtime", "extract"],
            contracts: ["research.extract.v1"],
          },
          {
            name: "firecrawl_browser_delete",
            description: "Delete a browser session.",
            capabilityIds: ["runtime"],
          },
          {
            name: "firecrawl_browser_list",
            description: "List browser sessions.",
            capabilityIds: ["observability"],
          },
          {
            name: "firecrawl_interact",
            description: "Interact with a scraped page in a live browser session.",
            capabilityIds: ["runtime", "extract"],
            contracts: ["research.extract.v1"],
          },
          {
            name: "firecrawl_interact_stop",
            description: "Stop an interact session.",
            capabilityIds: ["runtime"],
          },
        ],
      },
    ],
    docs: [
      {
        label: "MCP capability index",
        path: "docs/mcp-capability-index.md",
      },
    ],
    smokeChecks: [
      {
        id: "research.extract",
        description: "Extract one known customer or product URL.",
      },
    ],
  });
}

export function parallelModule(): AiSdrModuleDefinition {
  return module({
    id: "parallel",
    displayName: "Parallel research",
    packageName: "@ai-sdr/parallel",
    description: "Run deep research, monitoring, async task workflows, and optional enrichment through Parallel APIs and MCP tools.",
    providerKey: "parallel",
    capabilityIds: ["search", "extract", "enrichment", "source", "observability"],
    contracts: [
      "research.search.v1",
      "research.extract.v1",
      "research.deepResearch.v1",
      "research.enrich.v1",
      "research.monitor.v1",
      "signal.discovery.v1",
    ],
    providers: [parallelProvider()],
    mcpServers: [
      {
        id: "parallel-search",
        displayName: "Parallel Search MCP",
        providerKey: "parallel",
        transport: "http",
        url: "https://search.parallel.ai/mcp",
        auth: "optional-bearer",
        optionalEnv: [
          { name: "PARALLEL_API_KEY", description: "Optional bearer token for higher Parallel Search MCP limits." },
        ],
        tools: [
          {
            name: "web_search",
            description: "General-purpose web search inside an agent loop.",
            capabilityIds: ["search", "source"],
            contracts: ["research.search.v1", "signal.discovery.v1"],
          },
          {
            name: "web_fetch",
            description: "Fetch token-efficient markdown from a specific URL.",
            capabilityIds: ["extract"],
            contracts: ["research.extract.v1"],
          },
        ],
      },
      {
        id: "parallel-task",
        displayName: "Parallel Task MCP",
        providerKey: "parallel",
        transport: "http",
        url: "https://task-mcp.parallel.ai/mcp",
        auth: "bearer",
        requiredEnv: [
          { name: "PARALLEL_API_KEY", description: "Bearer token required by Parallel Task MCP." },
        ],
        tools: [
          {
            name: "createDeepResearch",
            description: "Start an async deep research task.",
            capabilityIds: ["search", "enrichment"],
            contracts: ["research.deepResearch.v1", "research.enrich.v1"],
          },
          {
            name: "createTaskGroup",
            description: "Start parallel enrichment tasks for rows or entity lists.",
            capabilityIds: ["enrichment"],
            contracts: ["research.enrich.v1"],
          },
          {
            name: "getStatus",
            description: "Poll status for an in-flight task or task group.",
            capabilityIds: ["observability"],
          },
          {
            name: "getResultMarkdown",
            description: "Fetch completed task output as markdown.",
            capabilityIds: ["extract", "enrichment"],
            contracts: ["research.extract.v1", "research.enrich.v1"],
          },
        ],
      },
    ],
    docs: [
      {
        label: "Parallel Search MCP",
        path: "docs/reference.md",
      },
      {
        label: "Parallel Task MCP",
        path: "docs/reference.md",
      },
      {
        label: "MCP capability index",
        path: "docs/mcp-capability-index.md",
      },
    ],
    smokeChecks: [
      {
        id: "parallel.web_search",
        description: "Run one broad search through the direct adapter or sandbox-mounted MCP.",
      },
      {
        id: "parallel.web_fetch",
        description: "Fetch one known URL through the sandbox-mounted Search MCP.",
      },
    ],
  });
}

export function neonModule(): AiSdrModuleDefinition {
  return module({
    id: "neon",
    displayName: "Neon Postgres",
    packageName: "@ai-sdr/neon",
    description: "Use Neon as the hosted Postgres database for durable SDR state.",
    providerKey: "neon",
    capabilityIds: ["database"],
    contracts: ["database.postgres.v1"],
    providers: [neonProvider()],
    docs: [
      {
        label: "Database setup",
        path: "docs/self-hosting.md",
      },
    ],
    smokeChecks: [
      {
        id: "database.migrate",
        command: "npm run db:migrate",
        description: "Run migrations against the configured Neon database.",
      },
    ],
  });
}

export function prospeoModule(): AiSdrModuleDefinition {
  return module({
    id: "prospeo",
    displayName: "Prospeo enrichment",
    packageName: "@ai-sdr/prospeo",
    description: "Resolve verified work email addresses for qualified prospects before outbound begins.",
    providerKey: "prospeo",
    capabilityIds: ["enrichment"],
    contracts: ["research.enrich.v1"],
    providers: [prospeoProvider()],
    smokeChecks: [
      {
        id: "email.enrich",
        description: "Enrich one prospect with a verified work email.",
      },
    ],
  });
}

export function convexModule(): AiSdrModuleDefinition {
  return module({
    id: "convex",
    displayName: "Convex state plane",
    packageName: "@ai-sdr/convex",
    description: "Use Convex as the reactive source of truth for SDR state, workflow checkpoints, agent threads, and live dashboard queries.",
    providerKey: "convex",
    capabilityIds: ["state"],
    contracts: [
      "state.reactive.v1",
      "state.workflow.v1",
      "state.agentThreads.v1",
      "state.auditLog.v1",
    ],
    providers: [convexProvider()],
    docs: [
      {
        label: "Agent-native architecture",
        path: "docs/agent-native-architecture.md",
      },
    ],
    smokeChecks: [
      {
        id: "state.convexHealth",
        command: "npx convex dev --once",
        description: "Validate Convex deployment config and generated functions.",
      },
    ],
  });
}

export function vercelAiGatewayModule(): AiSdrModuleDefinition {
  return module({
    id: "vercel-ai-gateway",
    displayName: "Vercel AI Gateway",
    packageName: "@ai-sdr/vercel-ai-gateway",
    description: "Route structured model calls and sandbox turns through a swappable model gateway.",
    providerKey: "vercel-ai-gateway",
    capabilityIds: ["model"],
    contracts: ["model.gateway.v1"],
    providers: [vercelAiGatewayProvider()],
  });
}

export function rivetModule(): AiSdrModuleDefinition {
  return module({
    id: "rivet",
    displayName: "Rivet runtime",
    packageName: "@ai-sdr/rivet",
    description: "Run stateful agent actors, workflow control, queues, and realtime runtime events.",
    providerKey: "rivet",
    capabilityIds: ["runtime"],
    contracts: ["runtime.actor.v1"],
    providers: [rivetProvider()],
    docs: [
      {
        label: "Agent-native architecture",
        path: "docs/agent-native-architecture.md",
      },
    ],
    smokeChecks: [
      {
        id: "runtime.rivetHealth",
        description: "Start the app and confirm the Rivet manager serves /api/rivet traffic.",
      },
    ],
  });
}

export function vercelSandboxModule(): AiSdrModuleDefinition {
  return module({
    id: "vercel-sandbox",
    displayName: "Vercel Sandbox runtime",
    packageName: "@ai-sdr/vercel-sandbox",
    description: "Run turn-scoped coding-agent style workflows with mounted skills and MCP tools.",
    providerKey: "vercel-sandbox",
    capabilityIds: ["runtime"],
    contracts: ["runtime.sandbox.v1"],
    providers: [vercelSandboxProvider()],
    smokeChecks: [
      {
        id: "sandbox.probe",
        command: "npm run sandbox:probe",
        description: "Run the sandbox compatibility probe.",
      },
    ],
  });
}

export function orchidMcpModule(): AiSdrModuleDefinition {
  return module({
    id: "orchid-mcp",
    displayName: "First-party MCP",
    packageName: "@ai-sdr/mcp",
    description: "Expose pipeline, lead, runtime, mail, CRM, and handoff tools through MCP.",
    providerKey: "orchid-mcp",
    capabilityIds: ["mcp"],
    contracts: ["mcp.tools.v1"],
    providers: [orchidMcpProvider()],
    docs: [
      {
        label: "MCP reference",
        path: "docs/reference.md",
      },
    ],
    smokeChecks: [
      {
        id: "pipeline.summary",
        description: "Call pipeline.summary through the configured MCP client.",
      },
    ],
  });
}

export function slackHandoffModule(): AiSdrModuleDefinition {
  return module({
    id: "slack-handoff",
    displayName: "Slack handoff",
    packageName: "@ai-sdr/slack",
    description: "Route handoff events into Slack.",
    providerKey: "slack",
    capabilityIds: ["handoff"],
    contracts: ["handoff.notify.v1"],
    providers: [slackHandoffProvider()],
    smokeChecks: [
      {
        id: "handoff.slack",
        description: "Send one test handoff to the configured Slack channel or webhook.",
      },
    ],
  });
}

export function defaultOrchidModules(): AiSdrModuleDefinition[] {
  return [
    normalizedWebhookModule(),
    apifyLinkedInModule(),
    parallelModule(),
    firecrawlModule(),
    convexModule(),
    neonModule(),
    prospeoModule(),
    vercelAiGatewayModule(),
    rivetModule(),
    vercelSandboxModule(),
    orchidMcpModule(),
    agentMailModule(),
    attioModule(),
    slackHandoffModule(),
  ];
}
