import { describe, expect, it } from "vitest";

import { isWeekdayInTimezone } from "../src/orchestration/discovery-window.js";

describe("isWeekdayInTimezone", () => {
  it("returns true for a Friday in New York", () => {
    expect(isWeekdayInTimezone(new Date("2026-04-24T13:00:00Z"), "America/New_York")).toBe(true);
  });

  it("returns false for a Saturday in New York", () => {
    expect(isWeekdayInTimezone(new Date("2026-04-25T13:00:00Z"), "America/New_York")).toBe(false);
  });
});
