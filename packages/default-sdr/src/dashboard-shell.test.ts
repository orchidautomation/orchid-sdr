import { describe, expect, it } from "vitest";

import {
  classifyDashboardWorkflowState,
  describeDashboardWorkflowSummary,
  filterDashboardRowsByWorkflowState,
  summarizeDashboardBurstWindow,
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

describe("filterDashboardRowsByWorkflowState", () => {
  const rows = [
    { stage: "capture_signal", status: "active", qualification: null, pausedReason: null },
    { stage: "build_research_brief", status: "active", qualification: null, pausedReason: null },
    { stage: "qualify", status: "paused", qualification: null, pausedReason: "campaign paused" },
    { stage: "qualify", status: "paused", qualification: { ok: true }, pausedReason: "workflow failed: knowledge path missing" },
  ];

  it("returns only workflow failures for the failed filter", () => {
    expect(filterDashboardRowsByWorkflowState(rows, "workflow_failed")).toEqual([rows[3]]);
  });

  it("returns paused rows for the paused filter", () => {
    expect(filterDashboardRowsByWorkflowState(rows, "paused")).toEqual([rows[2]]);
  });
});

describe("summarizeDashboardBurstWindow", () => {
  it("groups workflow state counts from the visible prospect window", () => {
    const summary = summarizeDashboardBurstWindow({
      recentProspects: [
        { stage: "capture_signal", status: "active" },
        { stage: "build_research_brief", status: "active" },
        { stage: "qualify", status: "paused", pausedReason: "workflow failed: knowledge path missing" },
        { stage: "qualify", status: "paused", pausedReason: "campaign paused" },
      ],
      visibleProspects: [
        { stage: "capture_signal", status: "active" },
        { stage: "qualify", status: "paused", pausedReason: "workflow failed: knowledge path missing" },
      ],
      recentSignals: [{ id: "sig_1" }],
      activeThreads: [{ id: "thr_1" }, { id: "thr_2" }],
      providerRuns: [{ status: "running" }, { status: "failed" }],
    });

    expect(summary.prospectWindowSize).toBe(4);
    expect(summary.visibleProspectWindowSize).toBe(2);
    expect(summary.signalWindowSize).toBe(1);
    expect(summary.activeThreadWindowSize).toBe(2);
    expect(summary.providerStatus).toEqual({
      running: 1,
      failed: 1,
    });
    expect(summary.workflowStates.map((row) => row.label)).toEqual([
      "workflow failed",
      "qualification pending",
    ]);
  });
});
