import { trellis, type TrellisAttioMap, type TrellisProviderDefinition } from "@trellis/gtm";

export function attio(options: { map?: TrellisAttioMap } = {}): TrellisProviderDefinition {
  return trellis.provider({
    id: "attio",
    kind: "crm",
    displayName: "Attio",
    config: {
      map: options.map,
    },
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

export function apify(): TrellisProviderDefinition {
  return trellis.provider({
    id: "apify",
    kind: "source",
    displayName: "Apify",
    env: [
      { name: "APIFY_TOKEN", description: "Apify API token used to fetch discovery dataset items." },
      { name: "APIFY_WEBHOOK_SECRET", description: "Optional shared secret for /webhooks/apify." },
      { name: "APIFY_BASE_URL", description: "Optional Apify API base URL. Default is https://api.apify.com/v2." },
    ],
    capabilities: ["signal.discovery", "webhooks.apify", "research.linkedinProfile"],
  });
}

export function prospeo(): TrellisProviderDefinition {
  return trellis.provider({
    id: "prospeo",
    kind: "enrichment",
    displayName: "Prospeo",
    env: [
      { name: "PROSPEO_API_KEY", description: "Prospeo API key used for contact and email enrichment." },
      { name: "PROSPEO_BASE_URL", description: "Optional Prospeo API base URL. Default is https://api.prospeo.io." },
    ],
    capabilities: ["email.enrich", "research.enrich"],
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
