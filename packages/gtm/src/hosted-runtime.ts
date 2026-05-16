import { configureProvider, registerApiProvider, registerProvider } from "@flue/sdk/app";
import { createFlueContext, type SessionData, type SessionEnv, type SessionStore } from "@flue/sdk/client";
import { getCloudflareAIBindingApiProvider, getVirtualSandbox } from "@flue/sdk/cloudflare";
import { resolveModel } from "@flue/sdk/internal";
import { bashFactoryToSessionEnv } from "@flue/sdk/sandbox";
type TrellisRuntimeContextFactoryInput = {
  env?: Record<string, unknown>;
  signal: {
    id?: unknown;
    traceId?: unknown;
    workspaceId?: unknown;
    payload?: Record<string, unknown>;
  };
  packs: unknown;
};

type TrellisD1Database = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown> | unknown;
      first<T = Record<string, unknown>>(): Promise<T | null> | T | null;
    };
  };
};

type TrellisEnv = Record<string, unknown> & {
  TRELLIS_DB?: TrellisD1Database;
  TRELLIS_AI_GATEWAY_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_GATEWAY_ID?: string;
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_API_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CF_AIG_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_HTTP_REFERER?: string;
  OPENROUTER_APP_TITLE?: string;
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
  configureTrellisModelProviders(env);
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
      resolveModel: (model: Parameters<typeof resolveModel>[0]) => resolveTrellisModel(model, env),
    },
    createDefaultEnv: async (): Promise<SessionEnv> => bashFactoryToSessionEnv(sandbox),
    createLocalEnv: async (): Promise<SessionEnv> => {
      throw new Error("Trellis hosted agents use the Trellis virtual sandbox by default.");
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

function configureTrellisModelProviders(env: TrellisEnv) {
  configureProvider("cloudflare-ai-gateway", compactProviderSettings({
    apiKey: readCloudflareAiGatewayToken(env),
  }));
  configureProvider("anthropic", compactProviderSettings({
    apiKey: readEnvString(env.ANTHROPIC_API_KEY),
    baseUrl: readEnvString(env.ANTHROPIC_BASE_URL),
  }));
  configureProvider("openai", compactProviderSettings({
    apiKey: readEnvString(env.OPENAI_API_KEY),
    baseUrl: readEnvString(env.OPENAI_BASE_URL),
  }));
  configureProvider("openrouter", compactProviderSettings({
    apiKey: readEnvString(env.OPENROUTER_API_KEY),
    baseUrl: readEnvString(env.OPENROUTER_BASE_URL),
    headers: compactHeaders({
      "HTTP-Referer": readEnvString(env.OPENROUTER_HTTP_REFERER),
      "X-Title": readEnvString(env.OPENROUTER_APP_TITLE) ?? "trellis-cloud-sdr",
    }),
  }));
}

function compactProviderSettings(input: {
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}) {
  return {
    ...(input.apiKey ? { apiKey: input.apiKey } : {}),
    ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
    ...(input.headers && Object.keys(input.headers).length > 0 ? { headers: input.headers } : {}),
  };
}

function compactHeaders(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function readEnvString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readCloudflareAiGatewayToken(env: TrellisEnv) {
  return readEnvString(env.CLOUDFLARE_AI_GATEWAY_TOKEN)
    ?? readEnvString(env.CF_AIG_TOKEN)
    ?? readEnvString(env.CLOUDFLARE_API_KEY)
    ?? readEnvString(env.CLOUDFLARE_API_TOKEN);
}

type ResolvedModel = NonNullable<ReturnType<typeof resolveModel>>;

function resolveTrellisModel(
  model: Parameters<typeof resolveModel>[0],
  env: TrellisEnv,
) {
  const resolved = resolveModel(model);
  if (!resolved) {
    return resolved;
  }

  return withCloudflareModelMetadata(withCloudflareAiGatewayUrl(resolved, env), env);
}

function withCloudflareAiGatewayUrl(model: ResolvedModel, env: TrellisEnv): ResolvedModel {
  if (model.provider !== "cloudflare-ai-gateway" || !model.baseUrl?.includes("{")) {
    return model;
  }

  const accountId = readEnvString(env.CLOUDFLARE_ACCOUNT_ID);
  const gatewayId = readEnvString(env.CLOUDFLARE_GATEWAY_ID) ?? readAiGatewayId(env);
  if (!accountId || !gatewayId) {
    return model;
  }
  const baseUrl = model.baseUrl.replace(/\{CLOUDFLARE_ACCOUNT_ID\}/g, accountId ?? "")
    .replace(/\{CLOUDFLARE_GATEWAY_ID\}/g, gatewayId);
  if (baseUrl.includes("{}") || baseUrl.includes("{CLOUDFLARE_ACCOUNT_ID}")) {
    return model;
  }

  return {
    ...model,
    baseUrl,
  };
}

function withCloudflareModelMetadata(model: ResolvedModel, env: TrellisEnv): ResolvedModel {
  if (model.api !== "cloudflare-ai-binding") {
    return model;
  }

  const overrideContextWindow = readPositiveInteger(env.TRELLIS_MODEL_CONTEXT_WINDOW);
  const overrideMaxTokens = readPositiveInteger(env.TRELLIS_MODEL_MAX_TOKENS);
  const metadata = cloudflareWorkersAiModelMetadata(model.id);
  const contextWindow = overrideContextWindow ?? metadata?.contextWindow ?? model.contextWindow;
  const maxTokens = overrideMaxTokens ?? metadata?.maxTokens ?? model.maxTokens;
  if (contextWindow === model.contextWindow && maxTokens === model.maxTokens && metadata?.reasoning === model.reasoning) {
    return model;
  }

  return {
    ...model,
    provider: metadata?.provider ?? model.provider,
    reasoning: metadata?.reasoning ?? model.reasoning,
    input: metadata?.input ?? model.input,
    contextWindow,
    maxTokens,
  };
}

function cloudflareWorkersAiModelMetadata(modelId: string) {
  switch (modelId) {
    case "@cf/openai/gpt-oss-20b":
    case "@cf/openai/gpt-oss-120b":
      return {
        provider: "cloudflare-workers-ai",
        reasoning: true,
        input: ["text"] as Array<"text" | "image">,
        contextWindow: 128_000,
        maxTokens: 16_384,
      };
    case "openai/gpt-5.5":
      return {
        provider: "cloudflare-ai-gateway",
        reasoning: true,
        input: ["text", "image"] as Array<"text" | "image">,
        contextWindow: 1_000_000,
        maxTokens: 128_000,
      };
    case "openai/gpt-5.4":
      return {
        provider: "cloudflare-ai-gateway",
        reasoning: true,
        input: ["text", "image"] as Array<"text" | "image">,
        contextWindow: 1_000_000,
        maxTokens: 128_000,
      };
    case "openai/gpt-5.2":
      return {
        provider: "cloudflare-ai-gateway",
        reasoning: true,
        input: ["text", "image"] as Array<"text" | "image">,
        contextWindow: 400_000,
        maxTokens: 128_000,
      };
    case "@cf/meta/llama-4-scout-17b-16e-instruct":
      return {
        provider: "cloudflare-workers-ai",
        reasoning: false,
        input: ["text", "image"] as Array<"text" | "image">,
        contextWindow: 128_000,
        maxTokens: 16_384,
      };
    default:
      return undefined;
  }
}

function createTrellisAiBinding(binding: unknown) {
  const ai = binding as { run?: (model: string, payload: unknown, options?: unknown) => Promise<unknown> | unknown };
  if (typeof ai.run !== "function") {
    return binding;
  }

  return {
    ...ai,
    async run(model: string, payload: unknown, options?: unknown) {
      const normalizedPayload = normalizeTrellisAiPayload(model, payload);
      const toolSafe = normalizeCloudflareFunctionToolNames(normalizedPayload);
      const messageSafePayload = normalizeCloudflareMessageToolNames(toolSafe.payload, toolSafe.originalToNormalized);
      const response = await ai.run?.(model, messageSafePayload, options);
      return restoreCloudflareFunctionToolNames(response, toolSafe.normalizedToOriginal);
    },
  };
}

function normalizeTrellisAiPayload(model: string, payload: unknown) {
  if (model.startsWith("@cf/openai/gpt-oss") || model.startsWith("openai/gpt-oss")) {
    return normalizeCloudflareOpenAiPayload(payload);
  }

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

function normalizeCloudflareOpenAiPayload(payload: unknown) {
  const record = asRecord(payload);
  if (!record) {
    return payload;
  }

  const messages = Array.isArray(record.messages)
    ? record.messages.flatMap((message) => {
        const item = asRecord(message);
        const role = typeof item?.role === "string" ? item.role : undefined;
        if (!role) {
          return [];
        }
        const content = normalizeMessageContent(item?.content) ?? "";
        return [{ ...item, role, content }];
      })
    : record.messages;

  const normalized: Record<string, unknown> = {
    ...record,
    messages,
    max_tokens: readPositiveNumber(record.max_tokens)
      ?? readPositiveNumber(record.max_completion_tokens)
      ?? 2048,
  };
  delete normalized.max_completion_tokens;
  delete normalized.stream_options;
  return normalized;
}

function normalizeCloudflareFunctionToolNames(payload: unknown) {
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.tools)) {
    return {
      payload,
      normalizedToOriginal: {} as Record<string, string>,
      originalToNormalized: {} as Record<string, string>,
    };
  }

  const used = new Set<string>();
  const normalizedToOriginal: Record<string, string> = {};
  const originalToNormalized: Record<string, string> = {};
  let changed = false;
  const tools = record.tools.flatMap((tool) => {
    const toolRecord = asRecord(tool);
    if (!toolRecord || toolRecord.type !== "function") {
      return [tool];
    }
    const fn = asRecord(toolRecord.function);
    const original = typeof fn?.name === "string" ? fn.name : undefined;
    if (!fn || !original) {
      return [tool];
    }

    const normalized = uniqueCloudflareToolName(original, used);
    normalizedToOriginal[normalized] = original;
    originalToNormalized[original] = normalized;
    if (normalized === original) {
      return [tool];
    }

    changed = true;
    return [{
      ...toolRecord,
      function: {
        ...fn,
        name: normalized,
      },
    }];
  });

  if (!changed) {
    return { payload, normalizedToOriginal, originalToNormalized };
  }

  return {
    payload: {
      ...record,
      tools,
    },
    normalizedToOriginal,
    originalToNormalized,
  };
}

function normalizeCloudflareMessageToolNames(payload: unknown, originalToNormalized: Record<string, string>) {
  if (Object.keys(originalToNormalized).length === 0) {
    return payload;
  }
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.messages)) {
    return payload;
  }

  let changed = false;
  const messages = record.messages.map((message) => {
    const normalized = normalizeToolNamesInJson(message, originalToNormalized);
    if (normalized !== message) {
      changed = true;
    }
    return normalized;
  });

  return changed ? { ...record, messages } : payload;
}

function normalizeToolNamesInJson(value: unknown, originalToNormalized: Record<string, string>): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const normalized = normalizeToolNamesInJson(item, originalToNormalized);
      if (normalized !== item) {
        changed = true;
      }
      return normalized;
    });
    return changed ? items : value;
  }
  const record = asRecord(value);
  if (!record) {
    return value;
  }

  let changed = false;
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    const next = normalizeToolNamesInJson(child, originalToNormalized);
    normalized[key] = next;
    if (next !== child) {
      changed = true;
    }
  }

  const fn = asRecord(normalized.function);
  if (fn && typeof fn.name === "string" && originalToNormalized[fn.name]) {
    normalized.function = {
      ...fn,
      name: originalToNormalized[fn.name],
    };
    changed = true;
  }
  if (typeof normalized.name === "string" && originalToNormalized[normalized.name]) {
    normalized.name = originalToNormalized[normalized.name];
    changed = true;
  }
  return changed ? normalized : value;
}

function uniqueCloudflareToolName(name: string, used: Set<string>) {
  const base = normalizeTrellisToolName(name);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    const tail = `_${suffix++}`;
    candidate = `${base.slice(0, Math.max(1, 128 - tail.length))}${tail}`;
  }
  used.add(candidate);
  return candidate;
}

async function restoreCloudflareFunctionToolNames(response: unknown, normalizedToOriginal: Record<string, string>) {
  if (Object.keys(normalizedToOriginal).length === 0 || !(response instanceof Response) || !response.body) {
    return response;
  }

  const body = await response.text();
  const rewritten = body.split("\n").map((line) => {
    if (!line.startsWith("data:")) {
      return line;
    }
    const prefixMatch = /^data:\s*/.exec(line);
    const prefix = prefixMatch?.[0] ?? "data: ";
    const data = line.slice(prefix.length);
    if (!data || data === "[DONE]") {
      return line;
    }
    try {
      return `${prefix}${JSON.stringify(restoreToolNamesInJson(JSON.parse(data), normalizedToOriginal))}`;
    } catch {
      return line;
    }
  }).join("\n");

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function restoreToolNamesInJson(value: unknown, normalizedToOriginal: Record<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => restoreToolNamesInJson(item, normalizedToOriginal));
  }
  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const restored: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    restored[key] = restoreToolNamesInJson(child, normalizedToOriginal);
  }

  const fn = asRecord(restored.function);
  if (fn && typeof fn.name === "string" && normalizedToOriginal[fn.name]) {
    restored.function = {
      ...fn,
      name: normalizedToOriginal[fn.name],
    };
  }
  if (typeof restored.name === "string" && normalizedToOriginal[restored.name]) {
    restored.name = normalizedToOriginal[restored.name];
  }
  return restored;
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

function readPositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
  }
  return undefined;
}

function createTrellisSessionStore(env: TrellisEnv): SessionStore {
  const db = env.TRELLIS_DB;
  if (!db?.prepare) {
    return createMemorySessionStore();
  }

  let ready: Promise<unknown> | undefined;
  const ensureReady = () => {
    ready ??= Promise.resolve(db.prepare(`
      CREATE TABLE IF NOT EXISTS trellis_agent_sessions (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).bind().run());
    return ready;
  };

  return {
    async save(id: string, data: SessionData) {
      await ensureReady();
      await db.prepare(`
        INSERT OR REPLACE INTO trellis_agent_sessions (id, data_json, updated_at)
        VALUES (?, ?, ?)
      `).bind(id, JSON.stringify(data), new Date().toISOString()).run();
    },
    async load(id: string) {
      await ensureReady();
      const row = await db.prepare("SELECT data_json FROM trellis_agent_sessions WHERE id = ?")
        .bind(id)
        .first<{ data_json: string }>();
      return row ? JSON.parse(row.data_json) as SessionData : null;
    },
    async delete(id: string) {
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
