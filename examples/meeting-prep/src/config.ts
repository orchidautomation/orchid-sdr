import { z } from "zod";
import { loadProcessEnvFiles } from "@trellis/framework";

loadProcessEnvFiles();

const booleanFromEnv = z
  .union([z.literal("true"), z.literal("false")])
  .default("false")
  .transform((value) => value === "true");

const optionalUrlFromEnv = z
  .union([z.string().url(), z.literal("")])
  .optional()
  .transform((value) => value || undefined);

const defaultAppUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default(defaultAppUrl),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DASHBOARD_PASSWORD: z.string().optional(),

  NO_SENDS_MODE: booleanFromEnv,
  TRELLIS_LOCAL_SMOKE_MODE: booleanFromEnv,

  RIVET_ENDPOINT: z.string().optional(),
  RIVET_TOKEN: z.string().optional(),
  RIVET_PROJECT: z.string().optional(),
  RIVET_ENV: z.string().optional(),
  RIVET_PUBLIC_ENDPOINT: z.string().optional(),
  RIVET_PUBLIC_TOKEN: z.string().optional(),

  CONVEX_DEPLOYMENT: z.string().optional(),
  CONVEX_DEPLOY_KEY: z.string().optional(),
  CONVEX_URL: optionalUrlFromEnv,
  NEXT_PUBLIC_CONVEX_URL: optionalUrlFromEnv,
  CONVEX_SITE_URL: optionalUrlFromEnv,

  AI_GATEWAY_API_KEY: z.string().optional(),
  VERCEL_AI_GATEWAY_KEY: z.string().optional(),
  VERCEL_OIDC_TOKEN: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),

  PARALLEL_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),

  TRELLIS_MCP_TOKEN: z.string().optional(),
  TRELLIS_SANDBOX_TOKEN: z.string().min(1),
  SIGNAL_WEBHOOK_SECRET: z.string().min(1),

  SANDBOX_COMPAT_PROBE_ON_STARTUP: booleanFromEnv,
  SANDBOX_COMPAT_PROBE_PROMPT: z.string().default("Reply with the single word ok."),
});

export type AppConfig = z.infer<typeof envSchema> & {
  gatewayApiKey: string | undefined;
  mcpToken: string;
};

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.parse(process.env);
  cachedConfig = {
    ...parsed,
    gatewayApiKey: parsed.AI_GATEWAY_API_KEY ?? parsed.VERCEL_AI_GATEWAY_KEY,
    mcpToken: parsed.TRELLIS_MCP_TOKEN ?? parsed.TRELLIS_SANDBOX_TOKEN,
  };
  return cachedConfig;
}

export function resetConfigForTests() {
  cachedConfig = null;
}

