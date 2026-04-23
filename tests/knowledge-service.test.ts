import { describe, expect, it } from "vitest";

import { KnowledgeService } from "../src/services/knowledge-service.js";

describe("KnowledgeService", () => {
  it("finds matching docs from the repo knowledge pack", async () => {
    const service = new KnowledgeService();
    const results = await service.search("handoff compliance", 5);

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.file === "handoff.md")).toBe(true);
  });
});
