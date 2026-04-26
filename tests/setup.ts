process.env.NODE_ENV = "test";
process.env.PORT = process.env.PORT ?? "3000";
process.env.APP_URL = process.env.APP_URL ?? "http://localhost:3000";
process.env.CONVEX_URL = process.env.CONVEX_URL ?? "https://example.convex.cloud";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/orchid_test";
process.env.HANDOFF_WEBHOOK_SECRET = process.env.HANDOFF_WEBHOOK_SECRET ?? "handoff-secret";
process.env.ORCHID_SDR_SANDBOX_TOKEN = process.env.ORCHID_SDR_SANDBOX_TOKEN ?? "sandbox-token";
process.env.AGENTMAIL_WEBHOOK_SECRET =
  process.env.AGENTMAIL_WEBHOOK_SECRET
  ?? `whsec_${Buffer.from("test_secret_value").toString("base64")}`;
