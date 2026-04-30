import { describe, expect, it } from "vitest";

import { buildDefaultSdrPageTitleSandboxProbeRequest } from "./dashboard-actions.js";

describe("dashboard action helpers", () => {
  it("builds a page-title sandbox probe request with stable defaults", () => {
    const result = buildDefaultSdrPageTitleSandboxProbeRequest({
      campaignId: "cmp_default",
      url: "https://playkit.sh",
      mcpServerName: "Firecrawl",
      metadataKind: "dashboard-firecrawl-probe",
    });

    expect(result).toMatchObject({
      prospectId: "dashboard",
      campaignId: "cmp_default",
      stage: "build_research_brief",
      systemPrompt: "Use available tools when needed. Keep the final answer to one short line.",
      prompt: "Use the Firecrawl MCP server to inspect https://playkit.sh and reply with the page title only.",
      metadata: {
        kind: "dashboard-firecrawl-probe",
        url: "https://playkit.sh",
        server: "Firecrawl",
      },
    });
    expect(result.turnId).toMatch(/^dashboard-page-title-probe-/);
  });
});
