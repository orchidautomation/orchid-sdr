import { describe, expect, it } from "vitest";

import {
  heuristicIcpQualification,
  shouldRejectAtSignalTriage,
} from "../src/services/qualification-engine.js";

const sampleIcp = `
# Buyer Personas
- Head of RevOps
- GTM Engineer

# Company Profile
- SignalForge
- B2B go-to-market motion

# Core Pains
- poorly structured Clay workflows
- outbound enrichment inefficiency

# Trigger Events
- signal-based outbound

# Positive Buying Signals
- Clay
- RevOps ownership

# Negative Signals
- simple email blasting
- recruiting or people role
`;

describe("heuristicIcpQualification", () => {
  it("qualifies prospects that clearly match the current ICP rubric", () => {
    const result = heuristicIcpQualification({
      prospect: {
        fullName: "Jordan Rivera",
        title: "Head of RevOps",
        company: "SignalForge",
        companyDomain: "signalforge.com",
        linkedinUrl: "https://www.linkedin.com/in/jordan-rivera",
        sourceSignalId: "sig_123",
      },
      sourceSignal: {
        source: "linkedin_public_post",
        url: "https://www.linkedin.com/posts/jordan-rivera_clay-waterfall-credit-burn-activity",
        authorTitle: "Head of RevOps | Building Clay waterfalls for outbound and ABM",
        authorCompany: "SignalForge",
        companyDomain: "signalforge.com",
        topic: "clay waterfall credit burn",
        content: "We keep wasting credits on poorly structured Clay workflows and outbound enrichment.",
        metadata: {},
      },
    }, sampleIcp);

    expect(result.ok).toBe(true);
    expect(result.decision).toBe("qualified");
    expect(result.matchedSegments.length).toBeGreaterThan(0);
    expect(result.checks.find((check) => check.key === "person_fit")?.passed).toBe(true);
    expect(result.checks.find((check) => check.key === "company_fit")?.passed).toBe(true);
    expect(result.checks.find((check) => check.key === "pain_or_trigger_fit")?.passed).toBe(true);
    expect(result.dimensions?.personQualified).toBe(true);
    expect(result.dimensions?.companyQualified).toBe(true);
    expect(result.dimensions?.signalQualified).toBe(true);
  });

  it("rejects obvious low-signal posts before deep research", () => {
    const result = heuristicIcpQualification({
      prospect: {
        fullName: "Avery Kim",
        title: "Marketing Coordinator",
        company: "Neighborhood Bakery",
        companyDomain: "bakery.example",
        linkedinUrl: "https://www.linkedin.com/in/avery-kim",
        sourceSignalId: "sig_456",
      },
      sourceSignal: {
        source: "linkedin_public_post",
        url: "https://www.linkedin.com/posts/avery-kim_local-email-blast-activity",
        authorTitle: "Marketing Coordinator",
        authorCompany: "Neighborhood Bakery",
        companyDomain: "bakery.example",
        topic: "email blasting",
        content: "Looking for a simple email blasting tool for weekend promos.",
        metadata: {},
      },
    }, sampleIcp);

    expect(shouldRejectAtSignalTriage(result)).toBe(true);
  });

  it("rejects prospects without a real ICP signal", () => {
    const result = heuristicIcpQualification({
      prospect: {
        fullName: "Avery Kim",
        title: "Marketing Coordinator",
        company: "Neighborhood Bakery",
        companyDomain: "bakery.example",
        linkedinUrl: "https://www.linkedin.com/in/avery-kim",
        sourceSignalId: "sig_456",
      },
      sourceSignal: {
        source: "linkedin_public_post",
        url: "https://www.linkedin.com/posts/avery-kim_local-email-blast-activity",
        authorTitle: "Marketing Coordinator",
        authorCompany: "Neighborhood Bakery",
        companyDomain: "bakery.example",
        topic: "email blasting",
        content: "Looking for a simple email blasting tool for weekend promos.",
        metadata: {},
      },
    }, sampleIcp);

    expect(result.ok).toBe(false);
    expect(result.decision).toBe("rejected");
    expect(result.reason).toMatch(/poor fit|insufficient match/i);
    expect(result.missingEvidence?.length).toBeGreaterThan(0);
  });

  it("rejects hiring posts from people or recruiting functions", () => {
    const result = heuristicIcpQualification({
      prospect: {
        fullName: "Roald Harvey, MBA",
        title: "Sr. Director of People",
        company: "People",
        companyDomain: null,
        linkedinUrl: "https://www.linkedin.com/in/roaldh",
        sourceSignalId: "sig_789",
      },
      sourceSignal: {
        source: "linkedin_public_post",
        url: "https://www.linkedin.com/posts/roaldh_example",
        authorTitle: "Sr. Director of People",
        authorCompany: "People",
        companyDomain: null,
        topic: "clay prospecting",
        content:
          "We're hiring a BDR. You'll use Clay, HubSpot, and AI-powered workflows to run signal-based outbound.",
        metadata: {},
      },
    }, sampleIcp);

    expect(result.ok).toBe(false);
    expect(result.disqualifiers.some((value) => /recruiting|people/i.test(value))).toBe(true);
    expect(result.disqualifiers.some((value) => /hiring/i.test(value))).toBe(true);
    expect(result.dimensions?.negativeSignalsPresent).toBe(true);
  });

  it("uses captured metadata context to avoid rejecting plausible GTM fits too early", () => {
    const result = heuristicIcpQualification({
      prospect: {
        fullName: "Eric Nowoslawski",
        title: "Founder",
        company: "Growth Engine X",
        companyDomain: "growthenginex.com",
        linkedinUrl: "https://www.linkedin.com/in/eric-nowoslawski",
        sourceSignalId: "sig_321",
      },
      sourceSignal: {
        source: "linkedin_public_post",
        url: "https://www.linkedin.com/posts/eric-nowoslawski_tools-for-gtm",
        authorTitle: "Founder",
        authorCompany: "Growth Engine X",
        companyDomain: "growthenginex.com",
        topic: "favorite api tools",
        content: "Sharing an updated list of tools we use for Clay, Claude Code, and GTM workflows.",
        metadata: {
          headline: "Founder Growth Engine X | Clay Enterprise Partner",
          about: "I use Claude Code, Clay, and GTM engineering workflows to build outbound systems.",
        },
      },
    }, sampleIcp);

    expect(shouldRejectAtSignalTriage(result)).toBe(false);
    expect(result.matchedSegments.length).toBeGreaterThan(0);
  });

  it("uses scraped evidence when shallow signal fields are missing", () => {
    const result = heuristicIcpQualification({
      prospect: {
        fullName: "Priya Shah",
        title: "Operator",
        company: "StackFlow",
        companyDomain: "stackflow.io",
        linkedinUrl: "https://www.linkedin.com/in/priya-shah",
        sourceSignalId: "sig_999",
      },
      sourceSignal: {
        source: "linkedin_public_post",
        url: "https://www.linkedin.com/posts/priya-shah_signal-based-ops-activity",
        authorTitle: "Operator",
        authorCompany: "StackFlow",
        companyDomain: "stackflow.io",
        topic: "new workflow",
        content: "Sharing a project update.",
        metadata: {},
      },
      evidence: {
        profileExtract: "Priya Shah is a GTM Engineer building Clay systems and RevOps automation.",
        companyExtract: "StackFlow is a B2B go-to-market platform running outbound enrichment and signal-based workflows.",
        sourcePostExtract: "We adopted Clay and are cleaning up credit burn from weak waterfall design.",
      },
    }, sampleIcp);

    expect(result.ok).toBe(true);
    expect(result.dimensions?.personQualified).toBe(true);
    expect(result.dimensions?.companyQualified).toBe(true);
    expect(result.dimensions?.signalQualified).toBe(true);
  });
});
