import { describe, expect, it } from "vitest";

import {
  convexStateTableBlueprint,
  stateSignalRecordInputSchema,
  stateWorkflowCheckpointInputSchema,
} from "../src/framework/index.js";
import {
  ConvexStatePlaneProvider,
  DisabledStatePlaneProvider,
} from "../src/services/state-plane.js";

describe("AI SDR state plane contract", () => {
  it("validates state signal and checkpoint inputs", () => {
    expect(() =>
      stateSignalRecordInputSchema.parse({
        campaignId: "cmp_1",
        provider: "webhook",
        source: "hubspot_form",
        signal: {
          sourceRef: "form_1",
          url: "https://example.com",
          authorName: "Casey",
          authorTitle: null,
          authorCompany: "Launch Labs",
          companyDomain: "launchlabs.io",
          topic: "demo request",
          content: "Asked for a demo.",
          metadata: {},
          capturedAt: Date.now(),
        },
      }),
    ).not.toThrow();

    expect(() =>
      stateWorkflowCheckpointInputSchema.parse({
        workflowName: "signal-ingest",
        entityType: "signal",
        entityId: "sig_1",
        step: "captured",
        status: "succeeded",
      }),
    ).not.toThrow();
  });

  it("declares the Convex tables required for canonical SDR state", () => {
    expect(convexStateTableBlueprint.map((table) => table.name)).toEqual([
      "signals",
      "prospects",
      "threads",
      "workflowCheckpoints",
      "agentThreads",
      "auditEvents",
    ]);
  });

  it("keeps a disabled provider for deployments before Convex is configured", async () => {
    const provider = new DisabledStatePlaneProvider();

    await expect(provider.recordWorkflowCheckpoint({
      workflowName: "test",
      entityType: "campaign",
      entityId: "cmp_1",
      step: "started",
      status: "running",
    })).resolves.toEqual({
      providerId: "disabled",
      checkpointId: null,
      stored: false,
    });
  });

  it("can instantiate the Convex provider without generated API files", () => {
    const provider = new ConvexStatePlaneProvider("http://localhost:3210");

    expect(provider.providerId).toBe("convex");
  });
});
