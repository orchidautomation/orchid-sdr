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
