import { describe, expect, it } from "vitest";

import { getClosedWonLookalikeExample } from "../src/examples/closed-won-lookalike.js";

describe("getClosedWonLookalikeExample", () => {
  it("publishes the full workflow and operator surfaces", () => {
    const example = getClosedWonLookalikeExample();

    expect(example.id).toBe("closed-won-lookalike-outbound");
    expect(example.workflow).toHaveLength(8);
    expect(example.workflow.map((step) => step.support)).toEqual([
      "adapter_gap",
      "placeholder",
      "adapter_gap",
      "adapter_gap",
      "adapter_gap",
      "native",
      "native",
      "native",
    ]);
    expect(example.mcpTools).toContain("example.closedWonLookalike");
    expect(example.operatorFlows.map((flow) => flow.command)).toContain(
      "npm run example:closed-won-lookalike -- --mode operator",
    );
  });
});
