import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { TrellisRepository } from "../src/repository.js";

describe("TrellisRepository.insertSignal", () => {
  it("returns the existing signal id when an upsert hits the source/source_ref conflict", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: "sig_existing" }],
    });
    const repository = new TrellisRepository({ query } as unknown as Pool);

    const signalId = await repository.insertSignal({
      id: "sig_new",
      campaignId: "cmp_default",
      source: "linkedin_public_post",
      sourceRef: "post-123",
      actorRunId: "run_123",
      datasetId: "dataset_123",
      url: "https://www.linkedin.com/posts/example",
      authorName: "Example Prospect",
      authorTitle: "Head of Growth",
      authorCompany: "PlayKit",
      companyDomain: "playkit.sh",
      topic: "clay workflow",
      content: "Example content",
      capturedAt: Date.now(),
      metadata: { id: "post-123" },
    });

    expect(signalId).toBe("sig_existing");
    expect(query).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0]?.[0] ?? "")).toContain("returning id");
  });
});
