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

  DATABASE_URL: z.string().min(1).optional(),
  NO_SENDS_MODE: optionalBooleanFromEnv,
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

  APIFY_TOKEN: z.string().optional(),
  APIFY_BASE_URL: z.string().default("https://api.apify.com/v2"),
  APIFY_LINKEDIN_DATASET_LIMIT: z.coerce.number().default(50),
  APIFY_X_DATASET_LIMIT: z.coerce.number().default(25),
  APIFY_LINKEDIN_TASK_ID: z.string().optional(),
  APIFY_LINKEDIN_ACTOR_ID: z.string().optional(),
  APIFY_LINKEDIN_POSTS_TASK_ID: z.string().optional(),
  APIFY_LINKEDIN_POSTS_ACTOR_ID: z.string().optional(),
  APIFY_LINKEDIN_PROFILE_TASK_ID: z.string().optional(),
  APIFY_LINKEDIN_PROFILE_ACTOR_ID: z.string().optional(),
  APIFY_X_TASK_ID: z.string().optional(),
  APIFY_X_ACTOR_ID: z.string().optional(),
  APIFY_LINKEDIN_INPUT_TEMPLATE: z.string().optional(),
  APIFY_LINKEDIN_POSTS_INPUT_TEMPLATE: z.string().optional(),
  APIFY_LINKEDIN_PROFILE_INPUT_TEMPLATE: z.string().optional(),
  APIFY_X_INPUT_TEMPLATE: z.string().optional(),
  APIFY_WEBHOOK_SECRET: z.string().optional(),
  SIGNAL_WEBHOOK_SECRET: z.string().optional(),

  DISCOVERY_INTERVAL_MS: z.coerce.number().default(60 * 60 * 1000),
  DISCOVERY_MAX_RUNS_PER_TICK: z.coerce.number().default(2),
  DISCOVERY_WEEKDAYS_ONLY: z
    .union([z.literal("true"), z.literal("false")])
    .default("true")
    .transform((value) => value === "true"),
  DISCOVERY_LINKEDIN_ENABLED: z
    .union([z.literal("true"), z.literal("false")])
    .default("true")
    .transform((value) => value === "true"),
  DISCOVERY_X_ENABLED: booleanFromEnv,
  DISCOVERY_LINKEDIN_SEED_TERMS: csvListWithDefault(
    "sales automation,revops,gtm,gtm engineering,claude code gtm,pipeline generation,lead routing",
  ),
  DISCOVERY_X_SEED_TERMS: csvListWithDefault(
    "sales automation,revops,gtm,gtm engineering,claude code gtm,pipeline generation",
  ),

  PROSPEO_API_KEY: z.string().optional(),
  PROSPEO_BASE_URL: z.string().default("https://api.prospeo.io"),

  PARALLEL_API_KEY: z.string().optional(),
  PARALLEL_BASE_URL: z.string().default("https://api.parallel.ai"),

  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_BASE_URL: z.string().default("https://api.firecrawl.dev"),

  AGENTMAIL_API_KEY: z.string().optional(),
  AGENTMAIL_BASE_URL: z.string().default("https://api.agentmail.to"),
  AGENTMAIL_WEBHOOK_SECRET: z.string().optional(),
  AGENTMAIL_AUTO_PROVISION_INBOX: booleanFromEnv,
  AGENTMAIL_DEFAULT_SENDER_NAME: z.string().optional(),
  AGENTMAIL_DEFAULT_INBOX_DOMAIN: z.string().optional(),

  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_DEFAULT_CHANNEL: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),

  ATTIO_API_KEY: z.string().optional(),
  ATTIO_BASE_URL: z.string().default("https://api.attio.com/v2"),
  ATTIO_DEFAULT_LIST_ID: z.string().optional(),
  ATTIO_DEFAULT_LIST_STAGE: z.string().optional(),
  ATTIO_AUTO_OUTBOUND_STAGE: z.string().default("Prospecting"),
  ATTIO_AUTO_POSITIVE_REPLY_STAGE: z.string().default("Qualification"),
  ATTIO_AUTO_NEGATIVE_REPLY_STAGE: z.string().default("Paused"),

  DEFAULT_CAMPAIGN_TIMEZONE: z.string().default("UTC"),

  TRELLIS_MCP_TOKEN: z.string().optional(),
  TRELLIS_SANDBOX_TOKEN: z.string().min(1),
  HANDOFF_WEBHOOK_SECRET: z.string().min(1),

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
