import { module, type AiSdrModuleDefinition } from "./index.js";
import {
  agentMailProvider,
  apifyLinkedInProvider,
  attioProvider,
  firecrawlProvider,
  normalizedWebhookProvider,
  orchidMcpProvider,
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
    description: "Search and extract pages for lead, company, and news research.",
    contracts: ["research.search.v1", "research.extract.v1"],
    providers: [firecrawlProvider()],
    smokeChecks: [
      {
        id: "research.extract",
        description: "Extract one known customer or product URL.",
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
    contracts: ["model.gateway.v1"],
    providers: [vercelAiGatewayProvider()],
  });
}

export function vercelSandboxModule(): AiSdrModuleDefinition {
  return module({
    id: "vercel-sandbox",
    displayName: "Vercel Sandbox runtime",
    packageName: "@ai-sdr/vercel-sandbox",
    description: "Run turn-scoped coding-agent style workflows with mounted skills and MCP tools.",
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
    firecrawlModule(),
    vercelAiGatewayModule(),
    vercelSandboxModule(),
    orchidMcpModule(),
    agentMailModule(),
    attioModule(),
    slackHandoffModule(),
  ];
}
