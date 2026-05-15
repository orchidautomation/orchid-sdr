import type { TrellisAttioMap } from "@trellis/gtm";

const attioMap = {
  companies: {
    name: "company",
    domains: "companyDomain",

    // Rename these keys to match custom Attio attribute API slugs.
    // icp_status: "qualification.decision",
    // qualification_summary: "qualification.summary",
    // latest_signal: "signal.payload.signal",
  },
  people: {
    name: "fullName",
    email_addresses: "email",
    job_title: "title",
    linkedin: "linkedinUrl",

    // buying_role: "qualification.persona",
  },
} satisfies TrellisAttioMap;

export default attioMap;
