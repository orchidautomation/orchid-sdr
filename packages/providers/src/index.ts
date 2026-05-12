import { trellis, type TrellisProviderDefinition } from "@trellis/gtm";

export function attio(): TrellisProviderDefinition {
  return trellis.provider({
    id: "attio",
    kind: "crm",
    displayName: "Attio",
    env: [
      { name: "ATTIO_API_KEY", description: "Attio API key used for CRM sync." },
      { name: "ATTIO_DEFAULT_LIST_ID", description: "Optional Attio list for prospect cards." },
    ],
    capabilities: ["crm.syncProspect", "crm.stagePromotion"],
  });
}

export function agentmail(): TrellisProviderDefinition {
  return trellis.provider({
    id: "agentmail",
    kind: "email",
    displayName: "AgentMail",
    env: [
      { name: "AGENTMAIL_API_KEY", description: "AgentMail API key used for outbound and replies." },
      { name: "AGENTMAIL_WEBHOOK_SECRET", description: "Svix webhook secret for inbound events." },
    ],
    capabilities: ["mail.send", "mail.reply", "mail.preview", "reply.webhook"],
  });
}

export function firecrawl(): TrellisProviderDefinition {
  return trellis.provider({
    id: "firecrawl",
    kind: "research",
    displayName: "Firecrawl",
    env: [
      { name: "FIRECRAWL_API_KEY", description: "Firecrawl API key used for extraction and research." },
    ],
    capabilities: ["research.search", "research.extract", "browser.run"],
  });
}

export function langfuse(): TrellisProviderDefinition {
  return trellis.provider({
    id: "langfuse",
    kind: "observability",
    displayName: "Langfuse",
    env: [
      { name: "LANGFUSE_PUBLIC_KEY", description: "Langfuse public key used for optional trace export." },
      { name: "LANGFUSE_SECRET_KEY", description: "Langfuse secret key used for optional trace export." },
      { name: "LANGFUSE_BASE_URL", description: "Optional Langfuse API base URL." },
    ],
    capabilities: ["trace.export", "evals.export"],
  });
}

export function braintrust(): TrellisProviderDefinition {
  return trellis.provider({
    id: "braintrust",
    kind: "observability",
    displayName: "Braintrust",
    env: [
      { name: "BRAINTRUST_API_KEY", description: "Braintrust API key used for optional trace export." },
      { name: "BRAINTRUST_PROJECT_ID", description: "Braintrust project id for trace export." },
      { name: "BRAINTRUST_BASE_URL", description: "Optional Braintrust API base URL." },
    ],
    capabilities: ["trace.export", "evals.export"],
  });
}
