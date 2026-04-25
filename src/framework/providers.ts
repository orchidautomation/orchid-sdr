import { provider, type AiSdrProviderDefinition } from "./index.js";

export function attioProvider(): AiSdrProviderDefinition {
  return provider({
    id: "attio",
    kind: "crm",
    displayName: "Attio",
    packageName: "@ai-sdr/attio",
    env: [
      { name: "ATTIO_API_KEY", description: "Attio API key used for CRM sync." },
      { name: "ATTIO_DEFAULT_LIST_ID", description: "Optional Attio list for prospect cards." },
      { name: "ATTIO_DEFAULT_LIST_STAGE", description: "Optional default list stage." },
    ],
    capabilities: ["crm.syncProspect", "crm.stagePromotion"],
  });
}

export function agentMailProvider(): AiSdrProviderDefinition {
  return provider({
    id: "agentmail",
    kind: "email",
    displayName: "AgentMail",
    packageName: "@ai-sdr/agentmail",
    env: [
      { name: "AGENTMAIL_API_KEY", description: "AgentMail API key used for outbound and replies." },
      { name: "AGENTMAIL_WEBHOOK_SECRET", description: "Svix webhook secret for inbound events." },
      { name: "AGENTMAIL_DEFAULT_SENDER_NAME", description: "Default sender display name." },
      { name: "AGENTMAIL_DEFAULT_INBOX_DOMAIN", description: "Default AgentMail inbox domain." },
    ],
    capabilities: ["mail.send", "mail.reply", "mail.preview", "reply.webhook"],
  });
}

export function apifyLinkedInProvider(): AiSdrProviderDefinition {
  return provider({
    id: "apify-linkedin",
    kind: "signal-source",
    displayName: "Apify LinkedIn public posts",
    packageName: "@ai-sdr/apify-linkedin",
    env: [
      { name: "APIFY_TOKEN", description: "Apify API token." },
      { name: "APIFY_WEBHOOK_SECRET", description: "Shared secret for Apify webhook delivery." },
      { name: "APIFY_LINKEDIN_TASK_ID", description: "Apify task ID for LinkedIn discovery." },
      { name: "APIFY_LINKEDIN_ACTOR_ID", description: "Apify actor ID for LinkedIn discovery." },
    ],
    capabilities: ["discovery.linkedinPublicPosts", "webhooks.apify"],
  });
}

export function normalizedWebhookProvider(): AiSdrProviderDefinition {
  return provider({
    id: "normalized-webhook",
    kind: "signal-source",
    displayName: "Normalized signal webhook",
    packageName: "@ai-sdr/webhooks",
    env: [
      { name: "SIGNAL_WEBHOOK_SECRET", description: "Shared secret for generic signal ingestion." },
    ],
    capabilities: ["webhooks.signals"],
  });
}

export function firecrawlProvider(): AiSdrProviderDefinition {
  return provider({
    id: "firecrawl",
    kind: "research",
    displayName: "Firecrawl",
    packageName: "@ai-sdr/firecrawl",
    env: [
      { name: "FIRECRAWL_API_KEY", description: "Firecrawl API key used for extraction and research." },
    ],
    capabilities: ["research.extract", "research.search"],
  });
}

export function parallelProvider(): AiSdrProviderDefinition {
  return provider({
    id: "parallel",
    kind: "research",
    displayName: "Parallel",
    packageName: "@ai-sdr/parallel",
    env: [
      { name: "PARALLEL_API_KEY", description: "Parallel API key used for search, extract, enrichment, monitor, and MCP auth." },
      { name: "PARALLEL_BASE_URL", description: "Optional Parallel API base URL for direct search." },
    ],
    capabilities: [
      "research.search",
      "research.extract",
      "research.deepResearch",
      "research.enrich",
      "research.monitor",
      "signal.discovery",
      "sandbox.mcp.search",
      "sandbox.mcp.fetch",
      "sandbox.mcp.task",
    ],
  });
}

export function neonProvider(): AiSdrProviderDefinition {
  return provider({
    id: "neon",
    kind: "database",
    displayName: "Neon Postgres",
    packageName: "@ai-sdr/neon",
    env: [
      { name: "DATABASE_URL", required: true, description: "Neon Postgres connection string." },
      { name: "NEON_API_KEY", description: "Optional Neon API key for future database provisioning automation." },
      { name: "NEON_PROJECT_ID", description: "Optional Neon project ID for future provisioning automation." },
    ],
    capabilities: ["database.postgres", "database.branching", "database.provisioning"],
  });
}

export function convexProvider(): AiSdrProviderDefinition {
  return provider({
    id: "convex",
    kind: "state",
    displayName: "Convex",
    packageName: "@ai-sdr/convex",
    env: [
      { name: "CONVEX_DEPLOYMENT", description: "Convex deployment selector used by the Convex CLI." },
      { name: "CONVEX_DEPLOY_KEY", description: "Convex deploy key for CI and production deploys." },
      { name: "CONVEX_URL", description: "Server-side Convex deployment URL used by the Node service." },
      { name: "NEXT_PUBLIC_CONVEX_URL", description: "Convex deployment URL used by browser clients." },
      { name: "CONVEX_SITE_URL", description: "Convex HTTP actions site URL for webhooks and callbacks." },
    ],
    capabilities: [
      "state.reactive",
      "state.workflow",
      "state.agentThreads",
      "state.auditLog",
      "dashboard.liveQueries",
      "agent.memory",
    ],
  });
}

export function rivetProvider(): AiSdrProviderDefinition {
  return provider({
    id: "rivet",
    kind: "runtime",
    displayName: "Rivet",
    packageName: "@ai-sdr/rivet",
    env: [
      { name: "RIVET_ENDPOINT", description: "Optional Rivet endpoint for hosted or self-hosted actor runtime." },
      { name: "RIVET_TOKEN", description: "Optional Rivet auth token." },
      { name: "RIVET_PROJECT", description: "Optional Rivet project slug or ID." },
      { name: "RIVET_ENV", description: "Optional Rivet environment name." },
      { name: "RIVET_PUBLIC_ENDPOINT", description: "Public Rivet endpoint returned to clients in serverless mode." },
      { name: "RIVET_PUBLIC_TOKEN", description: "Publishable Rivet token for public client connections." },
    ],
    capabilities: [
      "runtime.actors",
      "runtime.queues",
      "runtime.realtime",
      "runtime.workflows",
      "agent.controlPlane",
    ],
  });
}

export function vercelAiGatewayProvider(): AiSdrProviderDefinition {
  return provider({
    id: "vercel-ai-gateway",
    kind: "model",
    displayName: "Vercel AI Gateway",
    packageName: "@ai-sdr/vercel-ai-gateway",
    env: [
      { name: "AI_GATEWAY_API_KEY", description: "Preferred AI Gateway API key." },
      { name: "VERCEL_AI_GATEWAY_KEY", description: "Fallback AI Gateway key." },
    ],
    capabilities: ["llm.structured", "llm.sandbox"],
  });
}

export function vercelSandboxProvider(): AiSdrProviderDefinition {
  return provider({
    id: "vercel-sandbox",
    kind: "runtime",
    displayName: "Vercel Sandbox",
    packageName: "@ai-sdr/vercel-sandbox",
    env: [
      { name: "VERCEL_OIDC_TOKEN", description: "OIDC token for Vercel Sandbox auth." },
      { name: "VERCEL_TOKEN", description: "Token-based Vercel Sandbox auth." },
      { name: "VERCEL_TEAM_ID", description: "Vercel team ID for token-based auth." },
      { name: "VERCEL_PROJECT_ID", description: "Vercel project ID for token-based auth." },
    ],
    capabilities: ["sandbox.turns", "sandbox.skills", "sandbox.mcp"],
  });
}

export function orchidMcpProvider(): AiSdrProviderDefinition {
  return provider({
    id: "orchid-mcp",
    kind: "mcp",
    displayName: "Orchid first-party MCP",
    packageName: "@ai-sdr/mcp",
    env: [
      { name: "ORCHID_SDR_MCP_TOKEN", description: "Bearer token for remote MCP access." },
      {
        name: "ORCHID_SDR_SANDBOX_TOKEN",
        required: true,
        description: "Fallback MCP token and sandbox callback token.",
      },
    ],
    capabilities: ["mcp.remote", "pipeline.summary", "lead.inspect", "mail.send", "crm.syncProspect"],
  });
}

export function slackHandoffProvider(): AiSdrProviderDefinition {
  return provider({
    id: "slack-handoff",
    kind: "handoff",
    displayName: "Slack handoff",
    packageName: "@ai-sdr/slack",
    env: [
      { name: "SLACK_BOT_TOKEN", description: "Slack bot token for channel handoff." },
      { name: "SLACK_DEFAULT_CHANNEL", description: "Default Slack channel for handoff." },
      { name: "SLACK_WEBHOOK_URL", description: "Optional webhook URL for handoff." },
    ],
    capabilities: ["handoff.slack"],
  });
}
