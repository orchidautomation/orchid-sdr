import { describe, expect, it, vi } from "vitest";

import { previewDraftForProspect } from "../src/orchestration/prospect-workflow.js";

function createSnapshot() {
  return {
    prospect: {
      prospectId: "pros_1",
      accountId: null,
      campaignId: "cmp_default",
      fullName: "Ada Lovelace",
      firstName: "Ada",
      title: "RevOps Lead",
      company: "Analytical Engines",
      companyDomain: "analyticalengines.com",
      linkedinUrl: "https://linkedin.com/in/ada",
      twitterUrl: null,
      attioCompanyRecordId: null,
      attioPersonRecordId: null,
      attioListEntryId: null,
      sourceSignalId: "sig_1",
      status: "active",
      stage: "first_outbound",
      lastReplyClass: null,
      pausedReason: null,
    },
    qualificationReason: "Strong ICP fit",
    qualification: {
      engine: "test",
      ruleVersion: "test",
      decision: "qualified",
      ok: true,
      reason: "Strong ICP fit",
      summary: "Qualified against Clay-heavy GTM systems context.",
      confidence: 0.93,
      matchedSegments: ["Agency and service providers"],
      matchedSignals: ["Clay operator", "Outbound systems builder"],
      disqualifiers: [],
      checks: [
        {
          key: "person_fit",
          label: "Person fit",
          passed: true,
          detail: "Founder Growth Engine X | Clay Enterprise Partner",
          kind: "fit" as const,
        },
      ],
    },
    campaign: {
      id: "cmp_default",
      name: "Default SDR Campaign",
      status: "active",
      quietHoursStart: 21,
      quietHoursEnd: 8,
      touchCap: 5,
      emailConfidenceThreshold: 0.75,
      researchConfidenceThreshold: 0.65,
      sourceLinkedinEnabled: true,
      senderEmail: null,
      senderDisplayName: null,
      senderProviderInboxId: null,
    },
    thread: {
      id: "thr_1",
      stage: "first_outbound",
      status: "active",
      lastReplyClass: null,
      pausedReason: null,
      nextFollowUpAt: null,
      providerThreadId: null,
      providerInboxId: null,
    },
    email: null,
    researchBrief: {
      id: "rb_1",
      prospectId: "pros_1",
      campaignId: "cmp_default",
      summary: "Strong technical fit.",
      copyGuidance: {
        primaryAngle: "Clay workflow architecture",
        bestOpeningHook: "their Clay workflow architecture",
        whyNow: "They already publish strong GTM systems thinking.",
        avoidMentioning: ["internal acquisition mechanics"],
        ctaSuggestion: "Worth a brief look?",
      },
      evidence: [
        {
          title: "Clay workflow",
          url: "https://example.com/post",
          note: "Relevant buying signal",
        },
      ],
      confidence: 0.88,
      createdAt: Date.parse("2026-04-23T12:00:00.000Z"),
    },
    messages: [],
  };
}

describe("previewDraftForProspect", () => {
  it("falls back to deterministic copy when sandbox drafting fails", async () => {
    const snapshot = createSnapshot();
    const repository = {
      getProspectSnapshot: vi.fn(async () => snapshot),
      getLatestInboundMessage: vi.fn(async () => null),
      getSignal: vi.fn(async () => ({
        id: "sig_1",
        source: "linkedin_public_post",
        sourceRef: "post_1",
        actorRunId: "run_1",
        url: "https://linkedin.com/posts/1",
        authorName: "Ada Lovelace",
        authorTitle: "RevOps Lead",
        authorCompany: "Analytical Engines",
        companyDomain: "analyticalengines.com",
        twitterUrl: null,
        topic: "Clay workflow",
        content: "Using Clay heavily",
        capturedAt: Date.parse("2026-04-23T11:59:00.000Z"),
        metadata: {},
      })),
    };

    const result = await previewDraftForProspect(
      {
        context: { repository },
        runSandboxTurn: vi.fn(async () => {
          throw new Error("sandbox turn timed out after 90000ms");
        }),
      } as any,
      "pros_1",
      "first_outbound",
    );

    expect(repository.getProspectSnapshot).toHaveBeenCalledWith("pros_1");
    expect(result).toMatchObject({
      kind: "first_outbound",
      generatedBy: "fallback",
      fallbackReason: "sandbox turn timed out after 90000ms",
      subject: "Quick question, Ada",
    });
    expect(result.bodyText).toContain("their Clay workflow architecture");
    expect(result.bodyText).toContain("Worth a brief look?");
  });

  it("returns sandbox copy when the draft completes in time", async () => {
    const snapshot = createSnapshot();

    const result = await previewDraftForProspect(
      {
        context: {
          repository: {
            getProspectSnapshot: vi.fn(async () => snapshot),
            getLatestInboundMessage: vi.fn(async () => null),
            getSignal: vi.fn(async () => ({
              id: "sig_1",
              source: "linkedin_public_post",
              sourceRef: "post_1",
              actorRunId: "run_1",
              url: "https://linkedin.com/posts/1",
              authorName: "Ada Lovelace",
              authorTitle: "RevOps Lead",
              authorCompany: "Analytical Engines",
              companyDomain: "analyticalengines.com",
              twitterUrl: null,
              topic: "Clay workflow",
              content: "Using Clay heavily",
              capturedAt: Date.parse("2026-04-23T11:59:00.000Z"),
              metadata: {},
            })),
          },
        },
        runSandboxTurn: vi.fn(async () => ({
          turnId: "turn_1",
          outputText: JSON.stringify({
            subject: "Clay workflow architecture",
            bodyText: "Hi Ada,\n\nWorth a brief look?",
          }),
          transcript: [],
        })),
      } as any,
      "pros_1",
      "first_outbound",
    );

    expect(result).toEqual({
      kind: "first_outbound",
      subject: "Clay workflow architecture",
      bodyText: "Hi Ada,\n\nWorth a brief look?",
      generatedBy: "sandbox",
      fallbackReason: undefined,
    });
  });
});
