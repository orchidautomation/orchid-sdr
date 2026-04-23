import { describe, expect, it } from "vitest";

import { normalizeSignalWebhookPayload } from "../src/orchestration/source-ingest.js";

describe("normalizeSignalWebhookPayload", () => {
  it("normalizes a single arbitrary-source signal payload", () => {
    const result = normalizeSignalWebhookPayload({
      provider: "custom-source",
      source: "reddit_post",
      externalId: "run_123",
      signal: {
        url: "https://reddit.com/r/example/post",
        authorName: "Casey",
        authorTitle: "Growth Operator",
        authorCompany: "Launch Labs",
        companyDomain: "launchlabs.io",
        topic: "signal-based GTM",
        content: "We are rebuilding our outbound workflow stack.",
      },
    });

    expect(result.provider).toBe("custom-source");
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.source).toBe("reddit_post");
    expect(result.signals[0]?.signal.authorName).toBe("Casey");
    expect(result.signals[0]?.signal.topic).toBe("signal-based GTM");
  });

  it("accepts mixed-source batches and derives a stable sourceRef when absent", () => {
    const result = normalizeSignalWebhookPayload({
      provider: "batch-import",
      signals: [
        {
          source: "x_public_post",
          url: "https://x.com/example/status/1",
          name: "Jordan",
          title: "RevOps Lead",
          company: "Northstar",
          text: "We adopted Clay last month.",
        },
        {
          source: "podcast_mention",
          url: "https://example.fm/episodes/123",
          author: "Avery",
          role: "Founder",
          companyName: "Northstar",
          description: "Talking about GTM systems and agent workflows.",
        },
      ],
    });

    expect(result.signals).toHaveLength(2);
    expect(result.signals[0]?.signal.sourceRef).toBeTruthy();
    expect(result.signals[1]?.source).toBe("podcast_mention");
    expect(result.signals[1]?.signal.content).toMatch(/GTM systems/);
  });
});
