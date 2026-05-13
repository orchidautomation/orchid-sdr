import { randomUUID } from "node:crypto";
import path from "node:path";

import { Sandbox } from "@vercel/sandbox";
import { SandboxAgent } from "sandbox-agent";

import type { SandboxTurnRequest, SandboxTurnResponse } from "../domain/types.js";
import { loadTextFiles, pathExists } from "../lib/filesystem.js";
import { claudeSkillsRoot, knowledgeRoot, skillsRoot } from "../lib/project-paths.js";
import { collectTextFragments } from "../lib/text.js";
import type { AppContext } from "../services/runtime-context.js";

const SANDBOX_HOME = "/home/vercel-sandbox";
const SANDBOX_WORKSPACE = `${SANDBOX_HOME}/trellis`;
const SANDBOX_AGENT_VERSION = "0.5.0-rc.2";

export async function runSandboxTurn(
  context: AppContext,
  request: SandboxTurnRequest,
): Promise<SandboxTurnResponse> {
  const sdk = await SandboxAgent.start({
    sandbox: Sandbox.fromVercel({
      version: SANDBOX_AGENT_VERSION,
      apiKey: context.config.VERCEL_TOKEN,
      oidcToken: context.config.VERCEL_OIDC_TOKEN,
      teamId: context.config.VERCEL_TEAM_ID,
      projectId: context.config.VERCEL_PROJECT_ID,
    }),
  });

  try {
    await prepareSandboxWorkspace(sdk, context);
    const session = await sdk.createSession({
      id: request.turnId,
      agent: "claude",
      cwd: SANDBOX_WORKSPACE,
      model: context.framework.config.modelRouting?.sandbox?.stages?.[request.stage]
        ?? context.framework.config.modelRouting?.sandbox?.defaultModel
        ?? context.framework.config.modelRouting?.defaultModel
        ?? "moonshotai/kimi-k2.6",
      mode: "bypassPermissions",
    });

    const baseline = await sdk.getEvents({
      sessionId: session.id,
      limit: 1_000,
    });
    const baselineCursor = String(baseline.items.length);
    const transcript: unknown[] = [];
    const unsubscribe = session.onPermissionRequest((permissionRequest) => {
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
      unsubscribe();
    }
  } finally {
    await sdk.destroySandbox().catch(() => undefined);
    await sdk.dispose().catch(() => undefined);
  }
}

async function prepareSandboxWorkspace(sdk: SandboxAgent, context: AppContext) {
  await sdk.runProcess({
    command: "sh",
    args: ["-lc", `mkdir -p ${SANDBOX_WORKSPACE}/knowledge ${SANDBOX_WORKSPACE}/skills ${SANDBOX_WORKSPACE}/.claude/skills`],
  });

  await sdk.writeFsFile(
    { path: `${SANDBOX_WORKSPACE}/.mcp.json` },
    JSON.stringify(buildSandboxMcpConfig(context), null, 2),
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
      skillName: "default",
    },
    {
      sources: [
        {
          type: "local",
          source: `${SANDBOX_WORKSPACE}/skills`,
        },
        ...(hasClaudeSkills ? [{ type: "local" as const, source: `${SANDBOX_WORKSPACE}/.claude/skills` }] : []),
      ],
    },
  );
}

function buildSandboxMcpConfig(context: Pick<AppContext, "config">) {
  return {
    mcpServers: {
      trellis: {
        type: "http",
        url: "${TRELLIS_MCP_URL}",
        headers: {
          Authorization: "Bearer ${TRELLIS_SANDBOX_TOKEN}",
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
      ...(context.config.PARALLEL_API_KEY
        ? {
            "parallel-search": {
              type: "http",
              url: "https://search.parallel.ai/mcp",
              headers: {
                Authorization: "Bearer ${PARALLEL_API_KEY}",
              },
            },
          }
        : {}),
    },
  };
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
  const items: Array<{ payload: unknown }> = [];
  let nextCursor = cursor;

  while (true) {
    const page = await sdk.getEvents({
      sessionId,
      cursor: nextCursor,
      limit: 1_000,
    });
    items.push(...page.items);
    if (!page.nextCursor) {
      return { items };
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
    const payload = event.payload as Record<string, unknown>;
    if (payload.method === "message" && Array.isArray(payload.params?.content)) {
      const content = payload.params?.content as Array<{ type?: string; text?: string }>;
      for (const item of content) {
        if (item.type === "text" && item.text) {
          chunks.push(item.text);
        }
      }
    }
  }
  return chunks.join("\n").trim();
}

export function createTurnId(prefix = "turn") {
  return `${prefix}_${randomUUID()}`;
}
