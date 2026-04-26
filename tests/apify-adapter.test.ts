import { describe, expect, it } from "vitest";

import { ApifySourceAdapter } from "../src/adapters.js";

describe("ApifySourceAdapter", () => {
  it("normalizes nested LinkedIn author payloads", () => {
    const adapter = new ApifySourceAdapter();
    const [signal] = adapter.normalizeLinkedInSignals([
      {
        id: "7452737636865298432",
        entityId: "7452737636865298432",
        content: "I ranked 20+ GTM tools by pipeline impact.",
        linkedinUrl: "https://www.linkedin.com/posts/cephas-princely_i-ranked-20-gtm-tools-by-pipeline-impact-activity-7452737636865298432-IM3z",
        query: {
          search: "waterfall enrichment",
        },
        author: {
          name: "Cephas Princely",
          info: "Building AI GTM systems for SaaS | Automating outbound + inbound pipelines",
          linkedinUrl: "https://www.linkedin.com/in/cephas-princely",
        },
      },
    ]);

    expect(signal).toBeDefined();
    if (!signal) {
      throw new Error("signal was not normalized");
    }
    expect(signal.sourceRef).toBe("7452737636865298432");
    expect(signal.authorName).toBe("Cephas Princely");
    expect(signal.authorTitle).toContain("Building AI GTM systems for SaaS");
    expect(signal.topic).toBe("waterfall enrichment");
    expect(signal.url).toContain("linkedin.com/posts/cephas-princely");
    expect(signal.content).toContain("GTM tools");
  });

  it("derives useful company and profile hints from harvest-style linkedin profile payloads", () => {
    const adapter = new ApifySourceAdapter();
    const [signal] = adapter.normalizeLinkedInSignals([
      {
        id: "ACoAABwGd9kBoXaQLEatmOycieqTz5eGDzr6rq4",
        publicIdentifier: "bmguerrero",
        linkedinUrl: "https://www.linkedin.com/in/bmguerrero/",
        firstName: "Brandon",
        lastName: "Guerrero",
        fullName: "Brandon Guerrero",
        headline: "Sr. GTM Engineer | Clay Operator | Gumloop Expert",
        websites: ["https://cal.com/orchid/discovery"],
        followerCount: 3391,
        currentPosition: [
          {
            position: "Sr. GTM Engineer",
            companyName: "The Kiln",
            companyLinkedinUrl: "https://www.linkedin.com/company/the-kiln-agency/",
            companyUniversalName: "the-kiln-agency",
          },
        ],
      },
    ]);

    expect(signal).toBeDefined();
    if (!signal) {
      throw new Error("signal was not normalized");
    }
    expect(signal.authorName).toBe("Brandon Guerrero");
    expect(signal.authorTitle).toContain("Clay Operator");
    expect(signal.authorCompany).toBe("The Kiln");
    expect(signal.url).toBe("https://www.linkedin.com/in/bmguerrero/");
    expect(signal.topic).toBe("linkedin-profile");
    expect(signal.metadata.companyLinkedinUrl).toBe("https://www.linkedin.com/company/the-kiln-agency/");
    expect(signal.metadata.currentCompanyUniversalName).toBe("the-kiln-agency");
    expect(signal.metadata.featuredSummary).toContain("3391 followers");
  });

  it("builds one LinkedIn research payload for multiple queries", () => {
    const adapter = new ApifySourceAdapter() as unknown as {
      buildLinkedinResearchInput: (queries: string[]) => Record<string, unknown>;
    };

    expect(
      adapter.buildLinkedinResearchInput([
        "https://www.linkedin.com/company/the-kiln-agency/",
        "https://www.linkedin.com/in/bmguerrero/",
      ]),
    ).toEqual({
      profileScraperMode: "Profile details no email ($4 per 1k)",
      queries: [
        "https://www.linkedin.com/company/the-kiln-agency/",
        "https://www.linkedin.com/in/bmguerrero/",
      ],
    });
  });
});
