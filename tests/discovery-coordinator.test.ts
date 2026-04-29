import { describe, expect, it } from "vitest";

import { filterPlannedTerms, isScheduledTickStale } from "../src/orchestration/discovery-coordinator.js";

describe("discovery coordinator guards", () => {
  it("filters duplicate, running, and cooldown terms before launch", () => {
    const result = filterPlannedTerms(
      [
        { term: " RevOps ", reason: "seed", priority: 0.9 },
        { term: "revops", reason: "duplicate in plan", priority: 0.8 },
        { term: "crm migration", reason: "already running", priority: 0.7 },
        { term: "ai outbound", reason: "cooldown", priority: 0.6 },
        { term: "sales automation", reason: "eligible", priority: 0.5 },
      ],
      {
        runningTerms: new Set(["crm migration"]),
        recentTerms: new Set(["ai outbound", "crm migration"]),
      },
      2,
    );

    expect(result.terms).toEqual([
      { term: "revops", reason: "seed", priority: 0.9 },
      { term: "sales automation", reason: "eligible", priority: 0.5 },
    ]);
    expect(result.skippedTerms).toEqual([
      { term: "revops", reason: "duplicate term in same tick" },
      { term: "crm migration", reason: "term already has a running provider run" },
      { term: "ai outbound", reason: "term is within discovery cooldown window" },
    ]);
  });

  it("treats mismatched scheduled tick tokens as stale", () => {
    expect(isScheduledTickStale("tick_current", "tick_old")).toBe(true);
    expect(isScheduledTickStale("tick_current", "tick_current")).toBe(false);
    expect(isScheduledTickStale(null, "tick_old")).toBe(true);
    expect(isScheduledTickStale("tick_current", undefined)).toBe(false);
  });
});
