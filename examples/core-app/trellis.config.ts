import { defineAiSdr, defaultTrellisModules, providersFromModules } from "@trellis/framework";

const selectedModuleIds = [
  "normalized-webhook",
  "convex",
  "rivet",
  "vercel-sandbox",
  "vercel-ai-gateway",
  "trellis-mcp",
];

const modules = defaultTrellisModules().filter((module) => selectedModuleIds.includes(module.id));

export default defineAiSdr({
  name: "trellis-core",
  description: "Neutral Trellis core app scaffold with webhook intake, actor-backed processing, MCP access, and sandboxed agent turns.",
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
    overview: "knowledge/overview.md",
    instructions: "knowledge/instructions.md",
    output: "knowledge/output.md",
  },
  skills: [
    {
      id: "core-brief",
      path: "skills/core-brief",
      description: "Turn a structured webhook payload into a concise artifact with explicit open questions and next actions.",
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
      capabilityId: "mcp",
      providerId: "trellis-mcp",
      contractId: "mcp.tools.v1",
      default: true,
    },
  ],
  mcp: {
    toolGroups: ["knowledge", "records", "workflows", "runtime"],
  },
  packageBoundaries: [
    {
      id: "framework-core",
      packageName: "@trellis/framework",
      visibility: "public",
      description: "Capability schema, manifest validation, composition logic, and scaffold helpers.",
      capabilityIds: ["source", "state", "runtime", "model", "mcp"],
    },
  ],
  webhooks: [
    {
      id: "core-intake",
      displayName: "Core intake webhook",
      description: "Generic intake route for structured webhook events that should become Trellis work items.",
      method: "POST",
      path: "/webhooks/intake",
      providerId: "normalized-webhook",
      auth: "shared-secret-query-or-header",
      secretEnv: "SIGNAL_WEBHOOK_SECRET",
    },
  ],
  requiredEnv: [
    { name: "APP_URL", required: true, description: "Public app URL used for MCP and webhook callback surfaces." },
    { name: "CONVEX_URL", required: true, description: "Server-side Convex deployment URL." },
    { name: "NEXT_PUBLIC_CONVEX_URL", required: true, description: "Browser-side Convex deployment URL." },
    { name: "TRELLIS_SANDBOX_TOKEN", required: true, description: "Sandbox callback token and MCP fallback bearer token." },
    { name: "SIGNAL_WEBHOOK_SECRET", required: true, description: "Shared secret for the generic intake webhook." },
  ],
});
