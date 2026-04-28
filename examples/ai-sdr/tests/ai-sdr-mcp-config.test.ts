import { describe, expect, it } from "vitest";

import { buildClaudeCodeMcpConfig, mergeClaudeCodeMcpConfig } from "../../../packages/ai-sdr/src/mcp-config.js";

describe("ai-sdr mcp config helpers", () => {
  it("builds a Claude Code HTTP transport config", () => {
    expect(buildClaudeCodeMcpConfig({
      url: "http://localhost:3000/mcp/trellis",
      token: "dev-token",
    })).toEqual({
      mcpServers: {
        "trellis": {
          transport: {
            type: "http",
            url: "http://localhost:3000/mcp/trellis",
            headers: {
              Authorization: "Bearer dev-token",
            },
          },
        },
      },
    });
  });

  it("merges an trellis server into an existing .mcp.json document", () => {
    const merged = mergeClaudeCodeMcpConfig({
      existingSource: JSON.stringify({
        mcpServers: {
          other: {
            transport: {
              type: "http",
              url: "https://example.com/mcp",
              headers: {
                Authorization: "Bearer keep-me",
              },
            },
          },
        },
      }),
      url: "http://localhost:3000/mcp/trellis",
      token: "dev-token",
    });

    expect(JSON.parse(merged)).toEqual({
      mcpServers: {
        other: {
          transport: {
            type: "http",
            url: "https://example.com/mcp",
            headers: {
              Authorization: "Bearer keep-me",
            },
          },
        },
        "trellis": {
          transport: {
            type: "http",
            url: "http://localhost:3000/mcp/trellis",
            headers: {
              Authorization: "Bearer dev-token",
            },
          },
        },
      },
    });
  });
});
