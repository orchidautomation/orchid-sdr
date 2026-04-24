import { describe, expect, it } from "vitest";

import { evaluateSendAuthority } from "../src/services/policy-service.js";
import type { ProspectSnapshot } from "../src/repository.js";

function buildSnapshot(overrides?: Partial<ProspectSnapshot>): ProspectSnapshot {
  return {
    prospect: {
      prospectId: "pros_1",
      accountId: "acct_1",
      campaignId: "cmp_default",
      fullName: "Jane Doe",
      firstName: "Jane",
      title: "Head of Growth",
      company: "Acme",
      companyDomain: "acme.com",
      linkedinUrl: "https://linkedin.com/in/jane",
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
    qualificationReason: null,
    qualification: null,
    campaign: {
      id: "cmp_default",
      name: "Default",
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
    email: {
      address: "jane@acme.com",
      confidence: 0.9,
      source: "prospeo",
    },
    researchBrief: {
      id: "brief_1",
      prospectId: "pros_1",
      campaignId: "cmp_default",
      summary: "Strong fit",
      confidence: 0.8,
      evidence: [],
      createdAt: Date.now(),
    },
    messages: [],
    ...overrides,
  };
}

describe("evaluateSendAuthority", () => {
  it("allows a clean send", () => {
    const result = evaluateSendAuthority({
      snapshot: buildSnapshot(),
      controlFlags: {
        globalKillSwitch: false,
        noSendsMode: false,
        pausedCampaignIds: [],
      },
      kind: "first_outbound",
      emailConfidence: 0.9,
      researchConfidence: 0.8,
      policyPass: true,
      now: new Date("2026-04-22T15:00:00.000Z"),
    });

    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks quiet hours, low confidence, and kill switch", () => {
    const result = evaluateSendAuthority({
      snapshot: buildSnapshot(),
      controlFlags: {
        globalKillSwitch: true,
        noSendsMode: false,
        pausedCampaignIds: [],
      },
      kind: "first_outbound",
      emailConfidence: 0.4,
      researchConfidence: 0.4,
      policyPass: false,
      now: new Date("2026-04-22T02:00:00.000Z"),
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("global kill switch enabled");
    expect(result.reasons).toContain("quiet hours active");
    expect(result.reasons).toContain("email confidence below threshold");
    expect(result.reasons).toContain("research confidence below threshold");
    expect(result.reasons).toContain("content policy check failed");
  });
});
