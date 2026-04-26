import { describe, expect, it } from "vitest";

import {
  crmProspectSyncRequestSchema,
  crmProspectSyncResultSchema,
  normalizedCrmCompanySchema,
  normalizedCrmContactSchema,
} from "@ai-sdr/framework";

describe("framework CRM normalization schemas", () => {
  it("accepts a normalized CRM prospect sync request", () => {
    const request = crmProspectSyncRequestSchema.parse({
      providerId: "salesforce",
      prospectId: "pros_123",
      campaignId: "cmp_default",
      company: {
        name: "Northstar",
        domain: "northstar.ai",
        attributes: {
          sourceSystem: "hubspot",
        },
      },
      contact: {
        fullName: "Avery Stone",
        email: "avery@northstar.ai",
        title: "Head of Growth",
        companyName: "Northstar",
        companyDomain: "northstar.ai",
      },
      note: {
        subject: "AI SDR qualification",
        body: "Qualified from a warm demo request.",
      },
      listStage: "Prospecting",
    });

    expect(request.providerId).toBe("salesforce");
    expect(request.contact.email).toBe("avery@northstar.ai");
  });

  it("normalizes provider references in CRM sync results", () => {
    const result = crmProspectSyncResultSchema.parse({
      providerId: "hubspot",
      companyRef: {
        providerId: "hubspot",
        objectType: "company",
        objectId: "123",
        url: "https://app.hubspot.com/contacts/1/company/123",
      },
      contactRef: {
        providerId: "hubspot",
        objectType: "contact",
        objectId: "456",
      },
      warnings: [],
    });

    expect(result.companyRef?.objectType).toBe("company");
    expect(result.contactRef?.objectId).toBe("456");
  });

  it("keeps vendor-specific fields under attributes", () => {
    const company = normalizedCrmCompanySchema.parse({
      name: "Northstar",
      domain: "northstar.ai",
      attributes: {
        salesforceAccountType: "Prospect",
        hubspotLifecycleStage: "opportunity",
      },
    });
    const contact = normalizedCrmContactSchema.parse({
      fullName: "Jordan Lee",
      attributes: {
        salesforceLeadSource: "Web",
      },
    });

    expect(company.attributes?.salesforceAccountType).toBe("Prospect");
    expect(contact.attributes?.salesforceLeadSource).toBe("Web");
  });
});
