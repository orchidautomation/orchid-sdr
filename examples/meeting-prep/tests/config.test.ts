import { describe, expect, it } from "vitest";

import config from "../trellis.config.js";

describe("meeting prep config", () => {
  it("declares the meeting webhook and includes search while leaving crm optional", () => {
    expect(config.webhooks?.[0]?.path).toBe("/webhooks/meetings");
    expect(config.modules?.map((module) => module.id)).toContain("firecrawl");
    expect(config.modules?.map((module) => module.id)).not.toContain("attio");
  });
});
