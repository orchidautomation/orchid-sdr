import { defineAiSdr } from "./src/framework/index.js";
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
} from "./src/framework/providers.js";

export default defineAiSdr({
  name: "orchid-sdr",
  description: "Reference implementation for a self-hostable, composable AI SDR control plane.",
  knowledge: {
    product: "knowledge/product.md",
    icp: "knowledge/icp.md",
    usp: "knowledge/usp.md",
    compliance: "knowledge/compliance.md",
    negativeSignals: "knowledge/negative-signals.md",
    handoff: "knowledge/handoff.md",
  },
  skills: [
    {
      id: "icp-qualification",
      path: "skills/icp-qualification",
      description: "Qualify prospects against the repo-managed ICP.",
    },
    {
      id: "research-brief",
      path: "skills/research-brief",
      description: "Turn source evidence into a concise research brief.",
    },
    {
      id: "research-checks",
      path: "skills/research-checks",
      description: "Validate source quality and research sufficiency.",
    },
    {
      id: "sdr-copy",
      path: "skills/sdr-copy",
      description: "Draft outbound copy from approved evidence.",
    },
    {
      id: "reply-policy",
      path: "skills/reply-policy",
      description: "Classify replies and choose next steps.",
    },
    {
      id: "handoff-policy",
      path: "skills/handoff-policy",
      description: "Decide when to route a lead to a human.",
    },
  ],
  providers: [
    normalizedWebhookProvider(),
    apifyLinkedInProvider(),
    firecrawlProvider(),
    vercelAiGatewayProvider(),
    vercelSandboxProvider(),
    orchidMcpProvider(),
    agentMailProvider(),
    attioProvider(),
    slackHandoffProvider(),
  ],
  campaigns: [
    {
      id: "cmp_default",
      timezone: "America/New_York",
      noSendsMode: true,
      sources: ["normalized-webhook", "apify-linkedin"],
    },
  ],
  requiredEnv: [
    { name: "DATABASE_URL", required: true, description: "Postgres connection string." },
    { name: "APP_URL", required: true, description: "Public app URL used by sandboxes and webhooks." },
    { name: "HANDOFF_WEBHOOK_SECRET", required: true, description: "Shared secret for handoff webhooks." },
  ],
});
