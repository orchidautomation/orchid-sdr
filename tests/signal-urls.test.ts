import { describe, expect, it } from "vitest";

import { extractCompanyResearchUrl, extractLinkedinProfileUrl } from "../src/lib/signal-urls.js";

describe("signal url helpers", () => {
  it("prefers the author linkedin profile url over a post url", () => {
    const url = extractLinkedinProfileUrl(
      {
        author: {
          linkedinUrl: "https://www.linkedin.com/in/carolinfoehr",
        },
      },
      "https://www.linkedin.com/posts/carolinfoehr_example",
    );

    expect(url).toBe("https://www.linkedin.com/in/carolinfoehr");
  });

  it("derives a company research url from the signal metadata", () => {
    const url = extractCompanyResearchUrl({
      metadata: {
        contentAttributes: [
          {
            type: "COMPANY_NAME",
            company: {
              linkedinUrl: "https://www.linkedin.com/company/athennian/",
            },
          },
        ],
      },
      companyDomain: null,
    });

    expect(url).toBe("https://www.linkedin.com/company/athennian/");
  });
});
