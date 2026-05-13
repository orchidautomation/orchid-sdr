import { describe, expect, it } from "vitest";

import {
  extractCompanyLinkedinUrl,
  extractCompanyResearchUrl,
  extractLinkedinProfileUrl,
  extractTwitterProfileUrl,
} from "../src/lib/signal-urls.js";

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

  it("derives company linkedin and research urls from harvest profile metadata", () => {
    const metadata = {
      currentPosition: [
        {
          companyName: "The Kiln",
          companyLinkedinUrl: "https://www.linkedin.com/company/the-kiln-agency/",
        },
      ],
    };

    expect(extractCompanyLinkedinUrl(metadata)).toBe("https://www.linkedin.com/company/the-kiln-agency");
    expect(extractCompanyResearchUrl({ metadata, companyDomain: null })).toBe(
      "https://www.linkedin.com/company/the-kiln-agency/",
    );
  });

  it("does not mistake post or author profile urls for the employer company linkedin url", () => {
    const metadata = {
      linkedinUrl: "https://www.linkedin.com/posts/bmguerrero_example",
      author: {
        linkedinUrl: "https://www.linkedin.com/in/bmguerrero/",
      },
      contentAttributes: [
        {
          type: "COMPANY_NAME",
          company: {
            linkedinUrl: "https://www.linkedin.com/company/twenty/",
          },
        },
      ],
    };

    expect(extractCompanyLinkedinUrl(metadata)).toBeNull();
    expect(extractCompanyResearchUrl({ metadata, companyDomain: null })).toBe(
      "https://www.linkedin.com/company/twenty/",
    );
  });

  it("prefers explicit company websites from harvest company metadata", () => {
    const url = extractCompanyResearchUrl({
      metadata: {
        linkedinUrl: "https://www.linkedin.com/company/the-kiln-agency/",
        website: "https://thekiln.com",
      },
      companyDomain: null,
    });

    expect(url).toBe("https://thekiln.com");
  });

  it("derives a canonical twitter/x profile url from a post url fallback", () => {
    const url = extractTwitterProfileUrl(
      {
        authorUsername: "profit-management",
      },
      "https://x.com/profit-management/status/1234567890",
    );

    expect(url).toBe("https://x.com/profit-management");
  });
});
