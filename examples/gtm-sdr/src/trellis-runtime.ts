import { registerApiProvider, registerProvider } from "@flue/sdk/app";
import { createFlueContext, type SessionData, type SessionEnv, type SessionStore } from "@flue/sdk/client";
import { getCloudflareAIBindingApiProvider, getVirtualSandbox } from "@flue/sdk/cloudflare";
import { resolveModel } from "@flue/sdk/internal";
import { bashFactoryToSessionEnv } from "@flue/sdk/sandbox";
import type { TrellisRuntimeContextFactoryInput } from "@trellis/gtm";

type TrellisEnv = Record<string, unknown> & {
  TRELLIS_DB?: D1Database;
  TRELLIS_AI_GATEWAY_ID?: string;
  AI?: unknown;
};

type PackFile = {
  path: string;
  text: string;
};

export function withTrellisRuntime(env: Record<string, unknown>, request?: Request) {
  return {
    ...env,
    TRELLIS_RUNTIME_CWD: "/workspace",
    TRELLIS_RUNTIME_CONTEXT_FACTORY: (input: TrellisRuntimeContextFactoryInput) =>
      createTrellisRuntimeContext(input, request),
  };
}

async function createTrellisRuntimeContext(
  input: TrellisRuntimeContextFactoryInput,
  request?: Request,
) {
  const env = (input.env ?? {}) as TrellisEnv;
  registerApiProvider(getCloudflareAIBindingApiProvider());
  if (env.AI) {
    registerProvider("cloudflare", {
      api: "cloudflare-ai-binding",
      binding: createTrellisAiBinding(env.AI),
      gateway: { id: readAiGatewayId(env) },
    } as never);
  }

  const sandbox = await getVirtualSandbox();
  await preloadTrellisPacks(sandbox, input);

  return createFlueContext({
    id: stableAgentId(input),
    runId: stableRunId(input),
    payload: input.signal.payload ?? {},
    env,
    req: request,
    agentConfig: {
      systemPrompt: "",
      skills: {},
      roles: {},
      model: undefined,
      resolveModel,
    },
    createDefaultEnv: async (): Promise<SessionEnv> => bashFactoryToSessionEnv(sandbox),
    createLocalEnv: async (): Promise<SessionEnv> => {
      throw new Error("Trellis Cloudflare agents use the Trellis virtual sandbox by default.");
    },
    defaultStore: createTrellisSessionStore(env),
  });
}

async function preloadTrellisPacks(
  sandbox: Awaited<ReturnType<typeof getVirtualSandbox>>,
  input: TrellisRuntimeContextFactoryInput,
) {
  const bash = await Promise.resolve(sandbox());
  await bash.fs.mkdir("/workspace/.agents/skills", { recursive: true });
  await bash.fs.mkdir("/workspace/knowledge", { recursive: true });
  await bash.fs.writeFile("/workspace/AGENTS.md", renderAgentsMd(input));

  for (const file of readPackFiles(input.packs, "knowledge")) {
    const target = workspaceFile("knowledge", file.path);
    await ensureParentDir(bash, target);
    await bash.fs.writeFile(target, file.text);
  }

  for (const file of readPackFiles(input.packs, "skills")) {
    const target = workspaceFile(".agents/skills", file.path);
    await ensureParentDir(bash, target);
    await bash.fs.writeFile(target, file.text);
  }
}

function renderAgentsMd(input: TrellisRuntimeContextFactoryInput) {
  const knowledge = readPackFiles(input.packs, "knowledge")
    .map((file) => `- knowledge/${safePackPath(file.path)}`)
    .join("\n");
  return `You are a Trellis GTM agent.

Use the mounted markdown knowledge and SKILL.md files to complete the requested GTM step.
Never send email, update CRM, or call handoff webhooks directly. Trellis approval gates own those side effects.

Knowledge files:
${knowledge || "- none mounted yet"}
`;
}

async function ensureParentDir(bash: { fs: { mkdir(path: string, options?: { recursive?: boolean }): Promise<void> } }, filePath: string) {
  const parent = filePath.split("/").slice(0, -1).join("/") || "/";
  await bash.fs.mkdir(parent, { recursive: true });
}

function readPackFiles(packs: unknown, scope: "knowledge" | "skills"): PackFile[] {
  const root = asRecord(packs);
  const section = asRecord(root?.[scope]);
  const files = Array.isArray(section?.files) ? section.files : [];
  return files.flatMap((file) => {
    const record = asRecord(file);
    const filePath = typeof record?.path === "string" ? record.path : undefined;
    const text = typeof record?.text === "string" ? record.text : undefined;
    return filePath && text ? [{ path: filePath, text }] : [];
  });
}

function workspaceFile(prefix: string, packPath: string) {
  return `/workspace/${prefix}/${safePackPath(packPath)}`;
}

function safePackPath(value: string) {
  const normalized = value
    .split(/[\\/]+/)
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return normalized || "untitled.md";
}

function stableAgentId(input: TrellisRuntimeContextFactoryInput) {
  return normalizeId(input.signal.workspaceId ?? input.signal.id ?? "default");
}

function stableRunId(input: TrellisRuntimeContextFactoryInput) {
  return normalizeId(input.signal.traceId ?? input.signal.id ?? `run_${Date.now()}`);
}

function normalizeId(value: unknown) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 128) || "default";
}

function readAiGatewayId(env: TrellisEnv) {
  return typeof env.TRELLIS_AI_GATEWAY_ID === "string" && env.TRELLIS_AI_GATEWAY_ID.trim()
    ? env.TRELLIS_AI_GATEWAY_ID.trim()
    : "default";
}

function createTrellisAiBinding(binding: unknown) {
  const ai = binding as { run?: (model: string, payload: unknown, options?: unknown) => Promise<unknown> | unknown };
  if (typeof ai.run !== "function") {
    return binding;
  }

  return {
    ...ai,
    run(model: string, payload: unknown, options?: unknown) {
      return ai.run?.(model, normalizeTrellisAiPayload(model, payload), options);
    },
  };
}

function normalizeTrellisAiPayload(model: string, payload: unknown) {
  if (!model.startsWith("anthropic/")) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return payload;
  }

  const system: string[] = [];
  const messages = Array.isArray(record.messages) ? record.messages.flatMap((message) => {
    const item = asRecord(message);
    const role = typeof item?.role === "string" ? item.role : undefined;
    const content = normalizeMessageContent(item?.content);
    if (!role || !content) {
      return [];
    }
    if (role === "system") {
      system.push(content);
      return [];
    }
    const normalizedRole = role === "assistant" ? "assistant" : "user";
    return [{ ...item, role: normalizedRole, content }];
  }) : record.messages;

  const normalized: Record<string, unknown> = {
    ...record,
    messages,
    tools: normalizeTrellisTools(record.tools),
    max_tokens: readPositiveNumber(record.max_tokens)
      ?? readPositiveNumber(record.max_completion_tokens)
      ?? 2048,
  };
  delete normalized.max_completion_tokens;
  delete normalized.stream_options;
  if (system.length > 0) {
    normalized.system = system.join("\n\n");
  }
  return normalized;
}

function normalizeTrellisTools(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.flatMap((tool) => {
    const record = asRecord(tool);
    if (record?.type !== "function") {
      return record ? [record] : [];
    }

    const fn = asRecord(record.function);
    if (!fn) {
      return [];
    }
    const name = typeof fn.name === "string" ? fn.name : undefined;
    if (!name) {
      return [];
    }

    return [{
      type: "custom",
      name: normalizeTrellisToolName(name),
      description: typeof fn.description === "string" ? fn.description : "",
      input_schema: asRecord(fn.parameters) ?? {
        type: "object",
        properties: {},
      },
    }];
  });
}

function normalizeTrellisToolName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 128) || "tool";
}

function normalizeMessageContent(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.flatMap((part) => {
      const record = asRecord(part);
      const text = typeof record?.text === "string" ? record.text : undefined;
      return text ? [text] : [];
    }).join("\n");
  }
  return undefined;
}

function readPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function createTrellisSessionStore(env: TrellisEnv): SessionStore {
  const db = env.TRELLIS_DB;
  if (!db?.prepare) {
    return createMemorySessionStore();
  }

  let ready: Promise<unknown> | undefined;
  const ensureReady = () => {
    ready ??= db.prepare(`
      CREATE TABLE IF NOT EXISTS trellis_agent_sessions (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).bind().run();
    return ready;
  };

  return {
    async save(id, data) {
      await ensureReady();
      await db.prepare(`
        INSERT OR REPLACE INTO trellis_agent_sessions (id, data_json, updated_at)
        VALUES (?, ?, ?)
      `).bind(id, JSON.stringify(data), new Date().toISOString()).run();
    },
    async load(id) {
      await ensureReady();
      const row = await db.prepare("SELECT data_json FROM trellis_agent_sessions WHERE id = ?")
        .bind(id)
        .first<{ data_json: string }>();
      return row ? JSON.parse(row.data_json) as SessionData : null;
    },
    async delete(id) {
      await ensureReady();
      await db.prepare("DELETE FROM trellis_agent_sessions WHERE id = ?").bind(id).run();
    },
  };
}

function createMemorySessionStore(): SessionStore {
  const sessions = new Map<string, SessionData>();
  return {
    async save(id, data) {
      sessions.set(id, data);
    },
    async load(id) {
      return sessions.get(id) ?? null;
    },
    async delete(id) {
      sessions.delete(id);
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
