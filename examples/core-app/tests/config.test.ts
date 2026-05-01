import { describe, expect, it } from "vitest";

import config from "../trellis.config.js";

describe("core app config", () => {
  it("uses only the neutral core modules by default", () => {
    expect(config.modules?.map((module) => module.id)).toEqual([
      "normalized-webhook",
      "convex",
      "vercel-ai-gateway",
      "rivet",
      "vercel-sandbox",
      "trellis-mcp",
    ]);
    expect(Object.keys(config.knowledge)).toEqual(["overview", "instructions", "output"]);
  });
});
