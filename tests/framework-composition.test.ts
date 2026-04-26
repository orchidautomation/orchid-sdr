import { describe, expect, it } from "vitest";

import {
  attioModule,
  defaultOrchidModules,
  evaluateModuleComposition,
  normalizedWebhookModule,
  parallelModule,
} from "@ai-sdr/framework";

describe("AI SDR module composition", () => {
  it("recognizes the default stack as production parity", () => {
    const evaluation = evaluateModuleComposition(defaultOrchidModules(), {
      profile: "productionParity",
    });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.missingCapabilities).toEqual([]);
    expect(evaluation.missingContracts).toEqual([]);
    expect(evaluation.modulesByCapability.state).toEqual(["convex"]);
    expect(evaluation.modulesByContract["research.deepResearch.v1"]).toEqual(["parallel"]);
    expect(evaluation.modulesByContract["research.monitor.v1"]).toEqual(["parallel"]);
    expect(evaluation.modulesByContract["runtime.actor.v1"]).toEqual(["rivet"]);
    expect(evaluation.modulesByContract["runtime.sandbox.v1"]).toEqual(["vercel-sandbox"]);
  });

  it("reports the minimum missing pieces when providers are removed", () => {
    const evaluation = evaluateModuleComposition([
      normalizedWebhookModule(),
      parallelModule(),
      attioModule(),
    ]);

    expect(evaluation.ok).toBe(false);
    expect(evaluation.missingCapabilities).toEqual([
      "state",
      "runtime",
      "model",
      "mcp",
    ]);
    expect(evaluation.missingContracts).toEqual([
      "state.reactive.v1",
      "state.workflow.v1",
      "model.gateway.v1",
      "runtime.actor.v1",
      "mcp.tools.v1",
    ]);
  });
});
