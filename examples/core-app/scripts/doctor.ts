import { loadProcessEnvFiles } from "@trellis/framework";
import config from "../src/app-config.js";
import { collectConfigEnv } from "@trellis/framework";

loadProcessEnvFiles();

const required = collectConfigEnv(config).filter((envVar) => envVar.required);
const missing = required
  .map((envVar) => envVar.name)
  .filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("doctor ok");
}
