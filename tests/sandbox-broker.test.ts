import { describe, expect, it } from "vitest";

import { buildSandboxAgentBootstrapScript, buildSandboxMcpConfig } from "../src/orchestration/sandbox-broker.js";

describe("buildSandboxMcpConfig", () => {
  it("includes the hosted Parallel Search MCP by default", () => {
    const config = buildSandboxMcpConfig({
      config: {
        PARALLEL_API_KEY: undefined,
        FIRECRAWL_API_KEY: undefined,
      },
    } as any);

    expect(config).toEqual({
      mcpServers: {
        "orchid-sdr": {
          type: "http",
          url: "${ORCHID_SDR_MCP_URL}",
          headers: {
            Authorization: "Bearer ${ORCHID_SDR_SANDBOX_TOKEN}",
          },
        },
        "parallel-search": {
          type: "http",
          url: "https://search-mcp.parallel.ai/mcp",
        },
      },
    });
  });

  it("downloads the sandbox-agent binary with node fetch instead of curl", () => {
    const script = buildSandboxAgentBootstrapScript();

    expect(script).toContain("await fetch(url)");
    expect(script).toContain("writeFileSync(installPath, buffer)");
    expect(script).toContain("/home/vercel-sandbox/.local/bin/sandbox-agent");
    expect(script).not.toContain("curl -fsSL");
  });

  it("adds auth-backed Parallel Search and Firecrawl when keys are present", () => {
    const config = buildSandboxMcpConfig({
      config: {
        PARALLEL_API_KEY: "parallel_test",
        FIRECRAWL_API_KEY: "firecrawl_test",
      },
    } as any);

    expect(config.mcpServers["parallel-search"]).toEqual({
      type: "http",
      url: "https://search-mcp.parallel.ai/mcp",
      headers: {
        Authorization: "Bearer ${PARALLEL_API_KEY}",
      },
    });
    expect(config.mcpServers["parallel-task"]).toEqual({
      type: "http",
      url: "https://task-mcp.parallel.ai/mcp",
      headers: {
        Authorization: "Bearer ${PARALLEL_API_KEY}",
      },
    });
    expect(config.mcpServers.firecrawl).toEqual({
      type: "http",
      url: "https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp",
    });
  });
});
