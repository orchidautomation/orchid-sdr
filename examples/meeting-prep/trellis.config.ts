import { defineAiSdr, defaultTrellisModules, providersFromModules } from "@trellis/framework";

const selectedModuleIds = [
  "normalized-webhook",
  "convex",
  "rivet",
  "vercel-sandbox",
  "vercel-ai-gateway",
  "trellis-mcp",
  "attio",
];

const modules = defaultTrellisModules().filter((module) => selectedModuleIds.includes(module.id));

export default defineAiSdr({
  name: "meeting-prep",
  description: "Meeting prep example that turns booking webhooks into attendee-aware preparation briefs.",
  compositionTargets: ["minimum"],
  modelRouting: {
    defaultModel: "moonshotai/kimi-k2.6",
    sandbox: {
      defaultModel: "moonshotai/kimi-k2.6",
      stages: {
        respond_or_handoff: "moonshotai/kimi-k2.6",
      },
    },
  },
  knowledge: {
    product: "knowledge/product.md",
    prepRubric: "knowledge/prep-rubric.md",
    briefStyle: "knowledge/brief-style.md",
  },
  skills: [
    {
      id: "meeting-prep-brief",
      path: "skills/meeting-prep-brief",
      description: "Produce a pre-meeting brief from booking details, attendees, and known company context.",
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
      capabilityId: "crm",
      providerId: "attio",
      contractId: "crm.prospectSync.v1",
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
