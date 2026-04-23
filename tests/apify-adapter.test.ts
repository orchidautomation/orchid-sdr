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
});
