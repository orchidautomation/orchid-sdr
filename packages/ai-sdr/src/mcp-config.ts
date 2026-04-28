export type ClaudeCodeMcpTransport = {
  transport: {
    type: "http";
    url: string;
    headers: {
      Authorization: string;
    };
  };
};

export type ClaudeCodeMcpConfig = {
  mcpServers: Record<string, ClaudeCodeMcpTransport>;
};

export function buildClaudeCodeMcpConfig(input: {
  serverName?: string;
  url: string;
  token: string;
}): ClaudeCodeMcpConfig {
  const serverName = input.serverName?.trim() || "trellis";
  return {
    mcpServers: {
      [serverName]: {
        transport: {
          type: "http",
          url: input.url,
          headers: {
            Authorization: `Bearer ${input.token}`,
          },
        },
      },
    },
  };
}

export function mergeClaudeCodeMcpConfig(input: {
  existingSource?: string;
  serverName?: string;
  url: string;
  token: string;
}) {
  const nextConfig = buildClaudeCodeMcpConfig(input);
  const existing = parseMcpConfig(input.existingSource);
  const merged: ClaudeCodeMcpConfig = {
    mcpServers: {
      ...(existing?.mcpServers ?? {}),
      ...nextConfig.mcpServers,
    },
  };

  return JSON.stringify(merged, null, 2) + "\n";
}

function parseMcpConfig(source: string | undefined) {
  if (!source?.trim()) {
    return null;
  }

  return JSON.parse(source) as ClaudeCodeMcpConfig;
}
