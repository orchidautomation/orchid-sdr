import { trellis, type TrellisBrowserProfileMap, type TrellisMailSequenceMap, type TrellisAttioMap, type TrellisProviderDefinition } from "@trellis/gtm";

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

export function mail(options: { sequence?: TrellisMailSequenceMap; adapter?: "native" | "agentmail" } = {}): TrellisProviderDefinition {
  return trellis.provider({
    id: options.adapter === "agentmail" ? "agentmail" : "mail",
    kind: "mail",
    displayName: options.adapter === "agentmail" ? "AgentMail" : "Trellis Mail",
    config: {
      adapter: options.adapter ?? "native",
      sequence: options.sequence,
    },
    env: [
      { name: "TRELLIS_MAIL_FROM", description: "Default sender address for Trellis mail sends and replies." },
      { name: "TRELLIS_MAIL_REPLY_TO", description: "Optional reply-to address for Trellis mail." },
      { name: "AGENTMAIL_API_KEY", description: "Optional AgentMail API key when adapter is agentmail." },
      { name: "AGENTMAIL_INBOX_ID", description: "Optional AgentMail inbox id when adapter is agentmail." },
      { name: "AGENTMAIL_WEBHOOK_SECRET", description: "Optional AgentMail webhook secret when adapter is agentmail." },
    ],
    capabilities: [
      "mail.send",
      "mail.reply",
      "mail.forward",
      "mail.reject",
      "mail.preview",
      "mail.inbound",
      "mail.bounce",
      "mail.suppression.check",
      "mail.sequence.schedule",
    ],
  });
}

export function agentmail(options: { sequence?: TrellisMailSequenceMap } = {}): TrellisProviderDefinition {
  return trellis.provider({
    id: "agentmail",
    kind: "mail",
    displayName: "AgentMail",
    config: {
      adapter: "agentmail",
      sequence: options.sequence,
    },
    env: [
      { name: "AGENTMAIL_API_KEY", description: "AgentMail API key used for outbound and replies." },
      { name: "AGENTMAIL_INBOX_ID", description: "Default AgentMail inbox id for sequence sends and replies." },
      { name: "AGENTMAIL_WEBHOOK_SECRET", description: "Svix webhook secret for inbound events." },
    ],
    capabilities: ["mail.send", "mail.reply", "mail.preview", "mail.inbound", "reply.webhook"],
  });
}

export function research(options: { adapter?: "browser-run" | "firecrawl"; profiles?: TrellisBrowserProfileMap } = {}): TrellisProviderDefinition {
  return trellis.provider({
    id: options.adapter === "firecrawl" ? "firecrawl" : "research",
    kind: "research",
    displayName: options.adapter === "firecrawl" ? "Firecrawl" : "Trellis Research",
    config: {
      adapter: options.adapter ?? "browser-run",
      profiles: options.profiles,
    },
    env: [
      { name: "TRELLIS_BROWSER_RUN_BASE_URL", description: "Optional Browser Run quick action base URL." },
      { name: "FIRECRAWL_API_KEY", description: "Optional Firecrawl API key when adapter is firecrawl." },
    ],
    capabilities: [
      "research.search",
      "research.map",
      "research.scrape",
      "research.extract",
      "research.crawl.start",
      "research.crawl.status",
    ],
  });
}

export function browser(options: { profiles?: TrellisBrowserProfileMap } = {}): TrellisProviderDefinition {
  return trellis.provider({
    id: "browser",
    kind: "browser",
    displayName: "Trellis Browser",
    config: {
      profiles: options.profiles,
    },
    env: [
      { name: "TRELLIS_BROWSER_RUN_BASE_URL", description: "Optional Browser Run quick action base URL." },
    ],
    capabilities: [
      "browser.session.create",
      "browser.session.run",
      "browser.session.close",
      "browser.screenshot",
      "browser.pdf",
      "browser.interact",
    ],
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
    capabilities: ["enrich.mail"],
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
