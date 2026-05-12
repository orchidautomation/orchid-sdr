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
