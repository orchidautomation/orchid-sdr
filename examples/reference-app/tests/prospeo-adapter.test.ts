import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ProspeoEmailEnricher", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TRELLIS_SANDBOX_TOKEN = "sandbox-token";
    process.env.HANDOFF_WEBHOOK_SECRET = "handoff-secret";
    process.env.PROSPEO_API_KEY = "prospeo-key";
    process.env.PROSPEO_BASE_URL = "https://api.prospeo.io";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PROSPEO_API_KEY;
    delete process.env.PROSPEO_BASE_URL;
  });

  it("sends linkedin-aware enrich-person payloads and parses the nested email object", async () => {
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));

      expect(body).toEqual({
        only_verified_email: true,
        data: {
          full_name: "Ada Lovelace",
          linkedin_url: "https://www.linkedin.com/in/ada",
          company_name: "Analytical Engines",
          company_website: "analyticalengines.com",
        },
      });

      return new Response(
        JSON.stringify({
          error: false,
          person: {
            email: {
              status: "VERIFIED",
              revealed: true,
              email: "ada@analyticalengines.com",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const { ProspeoEmailEnricher } = await import("../src/adapters.js");
    const enricher = new ProspeoEmailEnricher();

    const result = await enricher.enrich({
      prospectId: "pros_1",
      accountId: "acct_1",
      campaignId: "cmp_default",
      fullName: "Ada Lovelace",
      firstName: "Ada",
      title: "RevOps Lead",
      company: "Analytical Engines",
      companyDomain: "analyticalengines.com",
      linkedinUrl: "https://www.linkedin.com/in/ada",
      twitterUrl: null,
      attioCompanyRecordId: null,
      attioPersonRecordId: null,
      attioListEntryId: null,
      sourceSignalId: "sig_1",
      status: "active",
      stage: "enrich_email",
      lastReplyClass: null,
      pausedReason: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      address: "ada@analyticalengines.com",
      confidence: 0.97,
      source: "prospeo",
    });
  });
});
