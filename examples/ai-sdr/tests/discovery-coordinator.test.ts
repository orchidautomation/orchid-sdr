import { describe, expect, it } from "vitest";

import { filterRunnableDiscoveryTerms } from "../../../packages/default-sdr/src/discovery-coordinator.js";

describe("discovery coordinator burst control", () => {
  it("skips terms that already have a running discovery run", () => {
    const selected = filterRunnableDiscoveryTerms({
      plannedTerms: [
        { term: "revops", reason: "historical winner", priority: 0.9 },
        { term: "sales automation", reason: "seed", priority: 0.8 },
      ],
      history: [],
      runningTerms: new Set(["revops"]),
      now: Date.now(),
      cooldownMs: 60_000,
      maxAdditionalRuns: 2,
    });

    expect(selected).toEqual([
      { term: "sales automation", reason: "seed", priority: 0.8 },
    ]);
  });

  it("applies a cooldown before re-running the same term", () => {
    const now = Date.now();
    const selected = filterRunnableDiscoveryTerms({
      plannedTerms: [
        { term: "revops", reason: "recent yield", priority: 0.9 },
        { term: "pipeline generation", reason: "fallback", priority: 0.7 },
      ],
      history: [
        {
          term: "revops",
          status: "active",
          priority: 0.9,
          totalRuns: 2,
          totalSignals: 4,
          totalProspects: 2,
          lastUsedAt: now - 15_000,
          lastYieldAt: now - 15_000,
        },
      ],
      runningTerms: new Set(),
      now,
      cooldownMs: 60_000,
      maxAdditionalRuns: 2,
    });

    expect(selected).toEqual([
      { term: "pipeline generation", reason: "fallback", priority: 0.7 },
    ]);
  });

  it("caps new work to remaining run capacity", () => {
    const selected = filterRunnableDiscoveryTerms({
      plannedTerms: [
        { term: "revops", reason: "seed", priority: 0.9 },
        { term: "sales automation", reason: "seed", priority: 0.8 },
        { term: "lead routing", reason: "seed", priority: 0.7 },
      ],
      history: [],
      runningTerms: new Set(),
      now: Date.now(),
      cooldownMs: 60_000,
      maxAdditionalRuns: 1,
    });

    expect(selected).toEqual([
      { term: "revops", reason: "seed", priority: 0.9 },
    ]);
  });
});
