import { defineAiSdr, defaultTrellisModules, providersFromModules } from "@trellis/framework";

const selectedModuleIds = [
  "normalized-webhook",
  "convex",
  "rivet",
  "vercel-sandbox",
  "vercel-ai-gateway",
  "trellis-mcp",
  "firecrawl",
];

const modules = defaultTrellisModules().filter((module) => selectedModuleIds.includes(module.id));

export default defineAiSdr({
  name: "meeting-prep",
  description: "Meeting prep example that turns booking webhooks into attendee-aware preparation briefs.",
  compositionTargets: ["minimum"],
  modelRouting: {
    defaultModel: "openai/gpt-5.4-mini",
    sandbox: {
      defaultModel: "openai/gpt-5.4-mini",
      stages: {
        respond_or_handoff: "openai/gpt-5.4-mini",
      },
    },
  },
  knowledge: {
    product: "knowledge/product.md",
    prepRubric: "knowledge/prep-rubric.md",
    briefStyle: "knowledge/brief-style.md",
    researchPolicy: "knowledge/research-policy.md",
  },
  skills: [
    {
      id: "meeting-prep-brief",
      path: "skills/meeting-prep-brief",
      description: "Produce a pre-meeting brief from booking details, attendees, and known company context.",
    },
    {
      id: "meeting-prep-account-research",
      path: "skills/meeting-prep-account-research",
      description: "Use web search to verify account, attendee, and recent company context before generating the prep brief.",
    },
  ],
  modules,
  providers: providersFromModules(modules),
  capabilityBindings: [
    {
      capabilityId: "state",
      providerId: "convex",
      contractId: "state.reactive.v1",
      default: true,
    },
    {
      capabilityId: "source",
      providerId: "normalized-webhook",
      contractId: "signal.webhook.v1",
      default: true,
    },
    {
      capabilityId: "model",
      providerId: "vercel-ai-gateway",
      contractId: "model.gateway.v1",
      default: true,
    },
    {
      capabilityId: "runtime",
      providerId: "rivet",
      contractId: "runtime.actor.v1",
      default: true,
    },
    {
      capabilityId: "runtime",
      providerId: "vercel-sandbox",
      contractId: "runtime.sandbox.v1",
      default: true,
    },
    {
      capabilityId: "search",
      providerId: "firecrawl",
      contractId: "research.search.v1",
      default: true,
    },
    {
      capabilityId: "extract",
      providerId: "firecrawl",
      contractId: "research.extract.v1",
      default: true,
    },
    {
      capabilityId: "mcp",
      providerId: "trellis-mcp",
      contractId: "mcp.tools.v1",
      default: true,
    },
  ],
  webhooks: [
    {
      id: "meeting-booking",
      displayName: "Meeting booking webhook",
      description: "Structured booking or calendar webhook for generating meeting prep briefs.",
      method: "POST",
      path: "/webhooks/meetings",
      providerId: "normalized-webhook",
      auth: "shared-secret-query-or-header",
      secretEnv: "SIGNAL_WEBHOOK_SECRET",
    },
  ],
});
