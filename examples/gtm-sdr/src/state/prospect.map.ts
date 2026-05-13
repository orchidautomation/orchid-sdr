import { trellis } from "@trellis/gtm";

const stateMap = trellis.state({
  tables: {
    accounts: {
      primaryKey: "domain",
      fields: {
        domain: "signal.payload.companyDomain",
        name: "signal.payload.company",
        customerStatus: "signal.payload.customerStatus",
        lastSignalId: "signal.id",
        lastSignalSource: "signal.source",
        researchSummary: "research.summary",
        fitStatus: "qualification.decision",
      },
      indexes: [
        { name: "accounts_by_status", fields: ["fitStatus"] },
        { name: "accounts_by_customer_status", fields: ["customerStatus"] },
      ],
    },
    people: {
      primaryKey: "email",
      fields: {
        email: "signal.payload.email",
        firstName: "signal.payload.firstName",
        lastName: "signal.payload.lastName",
        title: "signal.payload.title",
        company: "signal.payload.company",
        domain: "signal.payload.companyDomain",
        threadId: "signal.threadId",
        consent: { source: "signal.payload.consent", type: "json" },
      },
      indexes: [
        { name: "people_by_domain", fields: ["domain"] },
        { name: "people_by_thread", fields: ["threadId"] },
      ],
      relationships: {
        account: { table: "accounts", local: "domain", foreign: "domain" },
      },
    },
    prospects: {
      primaryKey: "id",
      fields: {
        id: "prospect.id",
        signalId: "signal.id",
        threadId: "signal.threadId",
        personEmail: "signal.payload.email",
        company: "signal.payload.company",
        domain: "signal.payload.companyDomain",
        title: "signal.payload.title",
        status: "qualification.decision",
        summary: "qualification.summary",
        confidence: { source: "qualification.confidence", type: "number" },
        nextStep: "qualification.nextStep",
        researchSummary: "research.summary",
        draftSubject: "draft.subject",
      },
      indexes: [
        { name: "prospects_by_domain", fields: ["domain"] },
        { name: "prospects_by_status", fields: ["status"] },
        { name: "prospects_by_thread", fields: ["threadId"] },
      ],
      relationships: {
        signal: { table: "signals", local: "signalId", foreign: "id" },
        person: { table: "people", local: "personEmail", foreign: "email" },
        account: { table: "accounts", local: "domain", foreign: "domain" },
      },
    },
    drafts: {
      primaryKey: "id",
      fields: {
        id: "draft.id",
        prospectId: "prospect.id",
        threadId: "signal.threadId",
        subject: "draft.subject",
        body: "draft.body",
        rationale: "draft.rationale",
        approvalStatus: "approval.status",
      },
      indexes: [
        { name: "drafts_by_thread", fields: ["threadId"] },
        { name: "drafts_by_prospect", fields: ["prospectId"] },
      ],
      relationships: {
        prospect: { table: "prospects", local: "prospectId", foreign: "id" },
      },
    },
    signals: {
      primaryKey: "id",
      fields: {
        id: "signal.id",
        threadId: "signal.threadId",
        source: "signal.source",
        provider: "signal.provider",
        payload: { source: "signal.payload", type: "json" },
      },
      indexes: [
        { name: "signals_by_thread", fields: ["threadId"] },
        { name: "signals_by_source", fields: ["source"] },
      ],
    },
  },
});

export default stateMap;
