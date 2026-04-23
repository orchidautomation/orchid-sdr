import { randomUUID } from "node:crypto";
import path from "node:path";

import { SandboxAgent } from "sandbox-agent";
import { Sandbox } from "@vercel/sandbox";

import type { SandboxTurnRequest, SandboxTurnResponse } from "../domain/types.js";
import { loadTextFiles, pathExists } from "../lib/filesystem.js";
import { claudeSkillsRoot, knowledgeRoot, skillsRoot } from "../lib/project-paths.js";
import { collectTextFragments } from "../lib/text.js";
import type { AppContext } from "../services/runtime-context.js";

const SANDBOX_HOME = "/home/vercel-sandbox";
const SANDBOX_WORKSPACE = `${SANDBOX_HOME}/orchid-sdr`;
const SKILL_PROFILE_NAME = "default";
const MCP_NAME = "orchid-sdr";
const SANDBOX_AGENT_INSTALL_SCRIPT = "https://releases.rivet.dev/sandbox-agent/0.5.0-rc.2/install.sh";
const DEFAULT_SANDBOX_AGENTS = ["claude", "codex"];
const CLAUDE_GATEWAY_MODEL = "moonshotai/kimi-k2.6";

export async function runSandboxTurn(
  context: AppContext,
  request: SandboxTurnRequest,
): Promise<SandboxTurnResponse> {
  assertSandboxReady(context);

  const sdk = await SandboxAgent.start({
    sandbox: createVercelSandboxProvider(context),
  });

  try {
    await prepareSandboxWorkspace(sdk, context);

    const session = await sdk.createSession({
      id: request.turnId,
      agent: "claude",
      cwd: SANDBOX_WORKSPACE,
      model: CLAUDE_GATEWAY_MODEL,
      mode: "bypassPermissions",
    });

    const initialEvents = await collectSessionEvents(sdk, session.id);
    const baselineCursor = String(initialEvents.items.length);
    const transcript: unknown[] = [];
    const unsubscribePermission = session.onPermissionRequest((permissionRequest) => {
      transcript.push(permissionRequest);
      void session.respondPermission(permissionRequest.id, "always");
    });

    try {
      const response = await session.prompt([
        {
          type: "text",
          text: [request.systemPrompt, "", request.prompt].join("\n"),
        },
      ]);

      const events = await collectSessionEvents(sdk, session.id, baselineCursor);
      transcript.push(...events.items);

      const outputText =
        extractAgentMessageText(events.items)
        || collectTextFragments(events.items.map((event) => event.payload)).join("\n").trim();

      return {
        turnId: request.turnId,
        outputText,
        transcript,
        usage: response.usage ?? undefined,
      };
    } finally {
      unsubscribePermission();
    }
  } finally {
    await sdk.destroySandbox();
    await sdk.dispose();
  }
}

async function prepareSandboxWorkspace(sdk: SandboxAgent, context: AppContext) {
  await sdk.runProcess({
    command: "sh",
    args: [
      "-lc",
      [
        `mkdir -p ${SANDBOX_WORKSPACE}`,
        `mkdir -p ${SANDBOX_WORKSPACE}/.claude`,
        `mkdir -p ${SANDBOX_WORKSPACE}/knowledge`,
        `mkdir -p ${SANDBOX_WORKSPACE}/skills`,
        `mkdir -p ${SANDBOX_WORKSPACE}/.claude/skills`,
      ].join(" && "),
    ],
  });

  await sdk.writeFsFile(
    { path: `${SANDBOX_WORKSPACE}/.claude/settings.json` },
    JSON.stringify({ permissionMode: "bypassPermissions" }, null, 2),
  );

  await sdk.writeFsFile(
    { path: `${SANDBOX_WORKSPACE}/.mcp.json` },
    JSON.stringify(
      {
        mcpServers: {
          [MCP_NAME]: {
            type: "http",
            url: "${ORCHID_SDR_MCP_URL}",
            headers: {
              Authorization: "Bearer ${ORCHID_SDR_SANDBOX_TOKEN}",
            },
          },
          ...(context.config.FIRECRAWL_API_KEY
            ? {
                firecrawl: {
                  type: "http",
                  url: "https://mcp.firecrawl.dev/${FIRECRAWL_API_KEY}/v2/mcp",
                },
              }
            : {}),
        },
      },
      null,
      2,
    ),
  );

  const hasClaudeSkills = await pathExists(claudeSkillsRoot);
  const [knowledgeFiles, skillFiles, claudeSkillFiles] = await Promise.all([
    loadTextFiles(knowledgeRoot),
    loadTextFiles(skillsRoot),
    hasClaudeSkills ? loadTextFiles(claudeSkillsRoot) : Promise.resolve([]),
  ]);

  for (const file of knowledgeFiles) {
    const destination = path.posix.join(SANDBOX_WORKSPACE, "knowledge", toPosix(file.relativePath));
    await ensureParentDir(sdk, destination);
    await sdk.writeFsFile({ path: destination }, file.content);
  }

  for (const file of skillFiles) {
    const destination = path.posix.join(SANDBOX_WORKSPACE, "skills", toPosix(file.relativePath));
    await ensureParentDir(sdk, destination);
    await sdk.writeFsFile({ path: destination }, file.content);
  }

  for (const file of claudeSkillFiles) {
    const destination = path.posix.join(SANDBOX_WORKSPACE, ".claude", "skills", toPosix(file.relativePath));
    await ensureParentDir(sdk, destination);
    await sdk.writeFsFile({ path: destination }, file.content);
  }

  await sdk.setSkillsConfig(
    {
      directory: SANDBOX_WORKSPACE,
      skillName: SKILL_PROFILE_NAME,
    },
    {
      sources: [
        {
          type: "local",
          source: `${SANDBOX_WORKSPACE}/skills`,
        },
        ...(hasClaudeSkills
          ? [
              {
                type: "local" as const,
                source: `${SANDBOX_WORKSPACE}/.claude/skills`,
              },
            ]
          : []),
      ],
    },
  );

}

async function ensureParentDir(sdk: SandboxAgent, filePath: string) {
  const parent = path.posix.dirname(filePath);
  await sdk.runProcess({
    command: "mkdir",
    args: ["-p", parent],
  });
}

function toPosix(relativePath: string) {
  return relativePath.split(path.sep).join(path.posix.sep);
}

async function collectSessionEvents(sdk: SandboxAgent, sessionId: string, cursor?: string) {
  const items: Array<{
    payload: unknown;
  }> = [];
  let nextCursor = cursor;

  while (true) {
    const page = await sdk.getEvents({
      sessionId,
      cursor: nextCursor,
      limit: 1_000,
    });
    items.push(...page.items);
    if (!page.nextCursor) {
      return {
        items,
      };
    }
    nextCursor = page.nextCursor;
  }
}

function extractAgentMessageText(events: Array<{ payload: unknown }>) {
  const chunks: string[] = [];

  for (const event of events) {
    if (!event.payload || typeof event.payload !== "object") {
      continue;
    }

    const method = "method" in event.payload ? event.payload.method : undefined;
    if (method !== "session/update") {
      continue;
    }

    const params = "params" in event.payload ? event.payload.params : undefined;
    if (!params || typeof params !== "object") {
      continue;
    }

    const update = "update" in params ? params.update : undefined;
    if (!update || typeof update !== "object") {
      continue;
    }

    const sessionUpdate = "sessionUpdate" in update ? update.sessionUpdate : undefined;
    if (sessionUpdate !== "agent_message_chunk") {
      continue;
    }

    const content = "content" in update ? update.content : undefined;
    if (!content || typeof content !== "object") {
      continue;
    }

    const text = "text" in content ? content.text : undefined;
    if (typeof text === "string") {
      chunks.push(text);
    }
  }

  return chunks.join("").trim();
}

function assertSandboxReady(context: AppContext) {
  const hasGatewayKey = Boolean(context.config.gatewayApiKey);
  const hasVercelAuth = Boolean(context.config.VERCEL_OIDC_TOKEN)
    || Boolean(
      context.config.VERCEL_TOKEN
        && context.config.VERCEL_TEAM_ID
        && context.config.VERCEL_PROJECT_ID,
    );

  if (!hasGatewayKey) {
    throw new Error("AI gateway key is required for sandbox turns");
  }

  if (!hasVercelAuth) {
    throw new Error(
      "Vercel Sandbox credentials are required. Set VERCEL_OIDC_TOKEN or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID.",
    );
  }
}

export function createTurnRequest(input: Omit<SandboxTurnRequest, "turnId">): SandboxTurnRequest {
  return {
    ...input,
    turnId: randomUUID(),
  };
}

function createVercelSandboxProvider(context: AppContext) {
  const agentPort = 3000;

  return {
    name: "vercel",
    defaultCwd: SANDBOX_HOME,
    async create() {
      const sandbox = await Sandbox.create({
        ports: [agentPort],
        runtime: "node22",
        timeout: 15 * 60_000,
        ...getVercelSandboxCredentials(context),
        env: {
          ANTHROPIC_BASE_URL: "https://ai-gateway.vercel.sh",
          ANTHROPIC_AUTH_TOKEN: context.config.gatewayApiKey ?? "",
          ANTHROPIC_API_KEY: "",
          ANTHROPIC_MODEL: CLAUDE_GATEWAY_MODEL,
          ANTHROPIC_DEFAULT_SONNET_MODEL: CLAUDE_GATEWAY_MODEL,
          ANTHROPIC_DEFAULT_OPUS_MODEL: CLAUDE_GATEWAY_MODEL,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: CLAUDE_GATEWAY_MODEL,
          CLAUDE_CODE_SUBAGENT_MODEL: CLAUDE_GATEWAY_MODEL,
          FIRECRAWL_API_KEY: context.config.FIRECRAWL_API_KEY ?? "",
          ORCHID_SDR_MCP_URL: `${context.config.APP_URL}/mcp/orchid-sdr`,
          ORCHID_SDR_SANDBOX_TOKEN: context.config.ORCHID_SDR_SANDBOX_TOKEN,
          VERCEL_AI_GATEWAY_KEY: context.config.gatewayApiKey ?? "",
        },
      });

      await runVercelCommand(sandbox, "sh", ["-c", `curl -fsSL ${SANDBOX_AGENT_INSTALL_SCRIPT} | sh`]);
      for (const agent of DEFAULT_SANDBOX_AGENTS) {
        await runVercelCommand(sandbox, "sandbox-agent", ["install-agent", agent]);
      }
      await sandbox.runCommand({
        cmd: "sandbox-agent",
        args: ["server", "--no-token", "--host", "0.0.0.0", "--port", String(agentPort)],
        detached: true,
      });

      return sandbox.sandboxId;
    },
    async destroy(sandboxId: string) {
      const sandbox = await getVercelSandbox(context, sandboxId);
      await sandbox.stop();
    },
    async getUrl(sandboxId: string) {
      const sandbox = await getVercelSandbox(context, sandboxId);
      return sandbox.domain(agentPort);
    },
    async ensureServer(sandboxId: string) {
      const sandbox = await getVercelSandbox(context, sandboxId);
      await sandbox.runCommand({
        cmd: "sandbox-agent",
        args: ["server", "--no-token", "--host", "0.0.0.0", "--port", String(agentPort)],
        detached: true,
      });
    },
  };
}

function getVercelSandboxCredentials(context: AppContext) {
  if (context.config.VERCEL_TOKEN && context.config.VERCEL_TEAM_ID && context.config.VERCEL_PROJECT_ID) {
    return {
      token: context.config.VERCEL_TOKEN,
      teamId: context.config.VERCEL_TEAM_ID,
      projectId: context.config.VERCEL_PROJECT_ID,
    };
  }

  return {};
}

async function getVercelSandbox(context: AppContext, sandboxId: string) {
  return Sandbox.get({
    sandboxId,
    ...getVercelSandboxCredentials(context),
  });
}

async function runVercelCommand(sandbox: Sandbox, cmd: string, args: string[]) {
  const result = await sandbox.runCommand({ cmd, args });
  if (result.exitCode !== 0) {
    const stderr = await result.stderr();
    throw new Error(`vercel command failed: ${cmd} ${args.join(" ")}\n${stderr}`);
  }
}
