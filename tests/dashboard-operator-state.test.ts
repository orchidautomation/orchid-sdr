import { describe, expect, it } from "vitest";

import { decorateDashboardProspects } from "../src/dashboard/operator-state.js";

describe("dashboard operator state", () => {
  it("marks recent qualification rows as fresh and qualifying", () => {
    const result = decorateDashboardProspects(
      [
        {
          id: "pros_1",
          fullName: "Ada Lovelace",
          company: "Analytical Engines",
          title: "RevOps Lead",
          source: "linkedin_public_post",
          sourceCapturedAt: "2026-04-29T16:00:00.000Z",
          stage: "qualify",
          status: "active",
          isQualified: false,
          qualificationReason: null,
          qualification: null,
          pausedReason: null,
          threadStage: "qualify",
          threadStatus: "active",
          threadPausedReason: null,
          updatedAt: "2026-04-29T16:01:00.000Z",
        },
      ],
      [],
      new Date("2026-04-29T16:05:00.000Z"),
    );

    expect(result.rows[0]?.operatorState).toBe("qualifying");
    expect(result.rows[0]?.isFresh).toBe(true);
    expect(result.stats.qualifyingRows).toBe(1);
    expect(result.stats.freshRows).toBe(1);
  });

  it("distinguishes paused control rows from failed rows", () => {
    const result = decorateDashboardProspects(
      [
        {
          id: "pros_1",
          fullName: "Paused Prospect",
          company: "Control Co",
          title: null,
          source: "linkedin_public_post",
          sourceCapturedAt: "2026-04-29T15:00:00.000Z",
          stage: "build_research_brief",
          status: "paused",
          isQualified: true,
          qualificationReason: "Strong ICP fit",
          qualification: null,
          pausedReason: "no sends mode",
          threadStage: "build_research_brief",
          threadStatus: "paused",
          threadPausedReason: "no sends mode",
          updatedAt: "2026-04-29T15:10:00.000Z",
        },
        {
          id: "pros_2",
          fullName: "Failed Prospect",
          company: "Blocked Co",
          title: null,
          source: "linkedin_public_post",
          sourceCapturedAt: "2026-04-29T14:00:00.000Z",
          stage: "build_research_brief",
          status: "paused",
          isQualified: true,
          qualificationReason: "Strong ICP fit",
          qualification: null,
          pausedReason: "email enrichment failed",
          threadStage: "build_research_brief",
          threadStatus: "paused",
          threadPausedReason: "email enrichment failed",
          updatedAt: "2026-04-29T14:10:00.000Z",
        },
      ],
      [],
      new Date("2026-04-29T16:05:00.000Z"),
    );

    expect(result.rows.find((row) => row.id === "pros_1")?.operatorState).toBe("paused");
    expect(result.rows.find((row) => row.id === "pros_2")?.operatorState).toBe("failed");
    expect(result.stats.pausedRows).toBe(1);
    expect(result.stats.failedRows).toBe(1);
  });

  it("marks poor-fit rows as rejected", () => {
    const result = decorateDashboardProspects(
      [
        {
          id: "pros_1",
          fullName: "Rejected Prospect",
          company: "No Fit Co",
          title: "Recruiter",
          source: "linkedin_public_post",
          sourceCapturedAt: "2026-04-29T13:00:00.000Z",
          stage: "qualify",
          status: "paused",
          isQualified: false,
          qualificationReason: "poor fit: recruiter title",
          qualification: {
            engine: "sandbox_icp_qualification_v1",
            ruleVersion: "1",
            decision: "rejected",
            ok: false,
            reason: "poor fit: recruiter title",
            summary: "Rejected by title.",
            confidence: 0.92,
            matchedSegments: [],
            matchedSignals: [],
            disqualifiers: ["recruiter title"],
            checks: [],
          },
          pausedReason: "poor fit: recruiter title",
          threadStage: "qualify",
          threadStatus: "paused",
          threadPausedReason: "poor fit: recruiter title",
          updatedAt: "2026-04-29T13:02:00.000Z",
        },
      ],
      [
        {
          id: "prun_1",
          provider: "apify",
          kind: "linkedin_public_post-source",
          externalId: "run_1",
          status: "failed",
          createdAt: "2026-04-29T13:00:00.000Z",
          updatedAt: "2026-04-29T13:00:30.000Z",
          durationMs: 30000,
          requestTerm: "revops",
          error: "upstream failed",
        },
      ],
      new Date("2026-04-29T16:05:00.000Z"),
    );

    expect(result.rows[0]?.operatorState).toBe("rejected");
    expect(result.stats.rejectedRows).toBe(1);
    expect(result.stats.providerFailures).toBe(1);
  });
});
