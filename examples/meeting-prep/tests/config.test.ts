import { describe, expect, it } from "vitest";

import config from "../trellis.config.js";

describe("meeting prep config", () => {
  it("declares the meeting webhook and optional attio lane", () => {
    expect(config.webhooks?.[0]?.path).toBe("/webhooks/meetings");
    expect(config.modules?.map((module) => module.id)).toContain("attio");
  });
});

