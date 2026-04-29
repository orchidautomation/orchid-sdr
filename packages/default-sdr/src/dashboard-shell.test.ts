import { describe, expect, it } from "vitest";

import {
  classifyDashboardWorkflowState,
  describeDashboardWorkflowSummary,
} from "./dashboard-shell.js";

describe("classifyDashboardWorkflowState", () => {
  it("prefers paused workflow failure over a stored qualification result", () => {
    expect(
      classifyDashboardWorkflowState({
        stage: "qualify",
        status: "paused",
        pausedReason: "workflow failed: knowledge path missing",
        qualification: { ok: true },
      }),
    ).toEqual({
      label: "workflow failed",
      kind: "danger",
    });
  });

  it("shows paused-before-qualification for paused capture rows", () => {
    expect(
      classifyDashboardWorkflowState({
        stage: "capture_signal",
        status: "paused",
        pausedReason: "campaign paused",
      }),
    ).toEqual({
      label: "paused before qualification",
      kind: "warn",
    });
  });
});

describe("describeDashboardWorkflowSummary", () => {
  it("falls back to paused reason before a blank qualification summary", () => {
    expect(
      describeDashboardWorkflowSummary({
        stage: "capture_signal",
        pausedReason: "campaign paused",
        qualification: null,
      }),
    ).toBe("campaign paused");
  });
});
