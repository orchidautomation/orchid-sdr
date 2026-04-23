import { z } from "zod";

function csvListWithDefault(defaultValue: string) {
  return z.string().default(defaultValue).transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

const booleanFromEnv = z
  .union([z.literal("true"), z.literal("false")])
  .default("false")
  .transform((value) => value === "true");

const optionalBooleanFromEnv = z
  .union([z.literal("true"), z.literal("false")])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DASHBOARD_PASSWORD: z.string().optional(),

  DATABASE_URL: z.string().min(1),
  NO_SENDS_MODE: optionalBooleanFromEnv,

  RIVET_ENDPOINT: z.string().optional(),
  RIVET_TOKEN: z.string().optional(),
  RIVET_PROJECT: z.string().optional(),
  RIVET_ENV: z.string().optional(),

  AI_GATEWAY_API_KEY: z.string().optional(),
  VERCEL_AI_GATEWAY_KEY: z.string().optional(),
  VERCEL_OIDC_TOKEN: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),

  APIFY_TOKEN: z.string().optional(),
  APIFY_BASE_URL: z.string().default("https://api.apify.com/v2"),
  APIFY_LINKEDIN_DATASET_LIMIT: z.coerce.number().default(25),
  APIFY_X_DATASET_LIMIT: z.coerce.number().default(25),
  APIFY_LINKEDIN_TASK_ID: z.string().optional(),
  APIFY_LINKEDIN_ACTOR_ID: z.string().optional(),
  APIFY_X_TASK_ID: z.string().optional(),
  APIFY_X_ACTOR_ID: z.string().optional(),
  APIFY_LINKEDIN_INPUT_TEMPLATE: z.string().optional(),
  APIFY_X_INPUT_TEMPLATE: z.string().optional(),
  APIFY_WEBHOOK_SECRET: z.string().optional(),
  SIGNAL_WEBHOOK_SECRET: z.string().optional(),

  DISCOVERY_INTERVAL_MS: z.coerce.number().default(60 * 60 * 1000),
  DISCOVERY_MAX_RUNS_PER_TICK: z.coerce.number().default(2),
  DISCOVERY_LINKEDIN_ENABLED: z
    .union([z.literal("true"), z.literal("false")])
    .default("true")
    .transform((value) => value === "true"),
  DISCOVERY_X_ENABLED: booleanFromEnv,
  DISCOVERY_LINKEDIN_SEED_TERMS: csvListWithDefault(
    "sales automation,revops,pipeline generation,lead routing",
  ),
  DISCOVERY_X_SEED_TERMS: csvListWithDefault(
    "sales automation,revops,gtm engineering,pipeline generation",
  ),

  PROSPEO_API_KEY: z.string().optional(),
  PROSPEO_BASE_URL: z.string().default("https://app.prospeo.io/api"),

  PARALLEL_API_KEY: z.string().optional(),
  PARALLEL_BASE_URL: z.string().default("https://api.parallel.ai"),

  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_BASE_URL: z.string().default("https://api.firecrawl.dev"),

  AGENTMAIL_API_KEY: z.string().optional(),
  AGENTMAIL_BASE_URL: z.string().default("https://api.agentmail.to"),
  AGENTMAIL_WEBHOOK_SECRET: z.string().optional(),

  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_DEFAULT_CHANNEL: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),

  ORCHID_SDR_SANDBOX_TOKEN: z.string().min(1),
  HANDOFF_WEBHOOK_SECRET: z.string().min(1),

  SANDBOX_COMPAT_PROBE_ON_STARTUP: booleanFromEnv,
  SANDBOX_COMPAT_PROBE_PROMPT: z.string().default("Reply with the single word ok."),
});

export type AppConfig = z.infer<typeof envSchema> & {
  gatewayApiKey: string | undefined;
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
  };
  return cachedConfig;
}
