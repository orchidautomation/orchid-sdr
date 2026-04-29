import { describe, expect, it } from "vitest";

import { normalizeProspectTitle, pickNormalizedProspectTitle } from "../src/lib/prospect-title.js";

describe("normalizeProspectTitle", () => {
  it("removes audience metric garbage", () => {
    expect(normalizeProspectTitle("849 followers")).toBeNull();
    expect(normalizeProspectTitle("10,434 followers")).toBeNull();
    expect(normalizeProspectTitle("500+ connections")).toBeNull();
    expect(normalizeProspectTitle("43,106 followers")).toBeNull();
  });

  it("preserves role-like titles and headlines", () => {
    expect(normalizeProspectTitle("Head of RevOps")).toBe("Head of RevOps");
    expect(normalizeProspectTitle("Founder | Building AI workflows")).toBe("Founder | Building AI workflows");
  });

  it("falls through to the first clean candidate", () => {
    expect(
      pickNormalizedProspectTitle(
        "10,434 followers",
        "500+ connections",
        "VP of Growth at Example",
      ),
    ).toBe("VP of Growth at Example");
  });
});
