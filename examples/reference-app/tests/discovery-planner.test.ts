import { describe, expect, it } from "vitest";

import {
  normalizeTerms,
  parseDiscoveryPlan,
  selectFallbackDiscoveryTerms,
} from "../src/orchestration/discovery-planner.js";

describe("discovery planner helpers", () => {
  it("normalizes and deduplicates seed terms", () => {
    expect(normalizeTerms([" RevOps ", "revops", "sales automation"])).toEqual([
      "revops",
      "sales automation",
    ]);
  });

  it("prefers unseen seeds before low-yield historical terms", () => {
    const selected = selectFallbackDiscoveryTerms({
      seedTerms: ["revops", "sales automation"],
      history: [
        {
          term: "revops",
          status: "active",
          priority: 0.8,
          totalRuns: 3,
          totalSignals: 5,
          totalProspects: 2,
          lastUsedAt: Date.now(),
          lastYieldAt: Date.now(),
        },
        {
          term: "crm migration",
          status: "seed",
          priority: 0.4,
          totalRuns: 4,
          totalSignals: 0,
          totalProspects: 0,
          lastUsedAt: Date.now(),
          lastYieldAt: null,
        },
      ],
      maxRuns: 2,
    });

    expect(selected).toHaveLength(2);
    expect(selected[0]?.term).toBe("sales automation");
  });

  it("parses json discovery plans from fenced output", () => {
    const plan = parseDiscoveryPlan(
      [
        "```json",
        '{"terms":[{"term":"buyer signals","reason":"Good fit","priority":0.91}]}',
        "```",
      ].join("\n"),
      2,
    );

    expect(plan).toEqual({
      terms: [
        {
          term: "buyer signals",
          reason: "Good fit",
          priority: 0.91,
        },
      ],
    });
  });
});
