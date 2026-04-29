export type ExampleSupportLevel = "native" | "adapter_gap" | "placeholder";

export interface ClosedWonLookalikeStep {
  key: string;
  title: string;
  outcome: string;
  support: ExampleSupportLevel;
  primitives: string[];
  notes: string[];
}

export interface ClosedWonLookalikeExample {
  id: string;
  name: string;
  summary: string;
  goal: string;
  manifestPath: string;
  knowledgePackPath: string;
  skillsPath: string;
  workflow: ClosedWonLookalikeStep[];
  actors: string[];
  state: string[];
  mcpTools: string[];
  operatorFlows: Array<{
    name: string;
    type: "cli" | "mcp";
    command: string;
    purpose: string;
  }>;
  gaps: Array<{
    area: string;
    status: ExampleSupportLevel;
    detail: string;
  }>;
}

export function getClosedWonLookalikeExample(): ClosedWonLookalikeExample {
  return {
    id: "closed-won-lookalike-outbound",
    name: "Closed-Won Lookalike Outbound",
    summary:
      "Turn a best-customer closed-won cohort into a ready-to-contact outbound pipeline using Trellis actors, MCP tools, knowledge packs, and CRM sync.",
    goal:
      "Show Trellis as a first-class GTM workflow runtime by expressing closed-won cohort selection, lookalike expansion, persona mapping, dedupe, enrichment, CRM upsert, and operator handoff in one example package.",
    manifestPath: "examples/closed-won-lookalike/manifest.json",
    knowledgePackPath: "examples/closed-won-lookalike/knowledge",
    skillsPath: "examples/closed-won-lookalike/skills",
    workflow: [
      {
        key: "pull_closed_won",
        title: "Pull closed-won deals from the source CRM",
        outcome: "Fetch a seed account set that represents best customers.",
        support: "adapter_gap",
        primitives: ["crm.syncProspect", "AttioAdapter", "campaignOps actor"],
        notes: [
          "The repo already writes to Attio, but it does not yet expose a first-party CRM read adapter for closed-won account selection.",
          "The example treats CRM export or a thin provider reader as the v1 entry point.",
        ],
      },
      {
        key: "segment_best_customers",
        title: "Segment the best-customer seed cohort",
        outcome: "Reduce the seed list to accounts that best represent the desired expansion motion.",
        support: "placeholder",
        primitives: ["knowledge/icp.md", "skills/icp-qualification", "sandbox turns"],
        notes: [
          "Qualification primitives already exist, but seed-cohort scoring is not yet a dedicated runtime stage.",
          "The example ships an overlay skill and knowledge pack to make this decision explicit.",
        ],
      },
      {
        key: "find_lookalikes",
        title: "Find lookalike companies",
        outcome: "Produce net-new target accounts from the best-customer cohort.",
        support: "native",
        primitives: ["ocean.searchCompanies", "sourceIngest actor", "pipeline.workflowFeed"],
        notes: [
          "Ocean is now available as a first-party adapter for lookalike company search.",
          "The workflow still needs a deterministic handoff from CRM cohort selection into this search step.",
        ],
      },
      {
        key: "identify_personas",
        title: "Identify target personas at lookalike accounts",
        outcome: "Find the right buyers or operators at each account.",
        support: "native",
        primitives: ["ocean.searchPeople", "ParallelResearchAdapter", "FirecrawlExtractAdapter"],
        notes: [
          "Ocean now covers lookalike people and persona search through the first-party backend surface.",
          "Parallel and Firecrawl still complement Ocean when you need current web context before sync.",
        ],
      },
      {
        key: "dedupe_against_crm",
        title: "Deduplicate accounts and contacts against CRM state",
        outcome: "Avoid re-working accounts, contacts, and active opportunities already in CRM.",
        support: "adapter_gap",
        primitives: ["AttioAdapter", "prospects table", "threads table"],
        notes: [
          "The repo stores synced Attio identifiers for prospects, but it does not yet expose a dedicated CRM dedupe read path across accounts and opportunity state.",
          "The example calls this out as a required thin provider layer.",
        ],
      },
      {
        key: "enrich_accounts_and_contacts",
        title: "Enrich companies and contacts",
        outcome: "Add research, contact emails, and account context before CRM upsert.",
        support: "native",
        primitives: ["ocean.enrichCompany", "research.search", "research.extract", "email.enrich", "prospectThread actor"],
        notes: [
          "Ocean now adds first-party company enrichment alongside the existing web research and email enrichment primitives.",
          "Company research is already covered by Parallel and Firecrawl-backed primitives.",
          "Contact email enrichment is already covered by the first-party `email.enrich` tool.",
        ],
      },
      {
        key: "upsert_crm_pipeline",
        title: "Upsert accounts, contacts, and prospects with a campaign tag",
        outcome: "Write the ready pipeline back into CRM with a dedicated campaign/list stage.",
        support: "native",
        primitives: ["crm.syncProspect", "AttioAdapter", "ATTIO_DEFAULT_LIST_STAGE"],
        notes: [
          "The repo already supports deterministic Attio upserts and optional list-stage assignment.",
          "Campaign-specific tagging is represented as list membership or list stage in v1.",
        ],
      },
      {
        key: "handoff_ready_pipeline",
        title: "Hand off a ready-to-contact pipeline",
        outcome: "Give operators a reviewable queue for outbound or human follow-up.",
        support: "native",
        primitives: ["pipeline.summary", "pipeline.qualifiedLeads", "handoff.slack", "handoff.webhook"],
        notes: [
          "The operator control plane and handoff primitives already exist.",
          "No-sends mode lets the workflow stop at a review queue instead of auto-sending.",
        ],
      },
    ],
    actors: [
      "discoveryCoordinator",
      "sourceIngest",
      "prospectThread",
      "campaignOps",
    ],
    state: [
      "campaigns",
      "signals",
      "prospects",
      "threads",
      "research_briefs",
      "contact_emails",
      "messages",
      "audit_events",
      "provider_runs",
    ],
    mcpTools: [
      "example.closedWonLookalike",
      "pipeline.summary",
      "pipeline.workflowFeed",
      "pipeline.qualifiedLeads",
      "runtime.flags",
      "ocean.searchCompanies",
      "ocean.searchPeople",
      "ocean.enrichCompany",
      "research.search",
      "research.extract",
      "email.enrich",
      "crm.syncProspect",
      "handoff.slack",
      "handoff.webhook",
    ],
    operatorFlows: [
      {
        name: "Blueprint summary",
        type: "cli",
        command: "npm run example:closed-won-lookalike -- --mode blueprint",
        purpose: "Print the example manifest, support map, and operator entry points.",
      },
      {
        name: "Live runtime inspection",
        type: "cli",
        command: "npm run example:closed-won-lookalike -- --mode operator",
        purpose: "Inspect campaign flags, discovery health, qualified leads, and workflow feed through the current backend.",
      },
      {
        name: "Remote MCP inspection",
        type: "mcp",
        command: "example.closedWonLookalike({\"includeRuntime\":true})",
        purpose: "Load the example package and append live runtime guidance from the first-party MCP surface.",
      },
      {
        name: "Ocean lookalike search",
        type: "mcp",
        command: "ocean.searchCompanies({\"lookalikeDomains\":[\"example.com\"],\"size\":25})",
        purpose: "Expand a closed-won seed domain into lookalike target accounts through the first-party Ocean adapter.",
      },
    ],
    gaps: [
      {
        area: "CRM closed-won reader",
        status: "adapter_gap",
        detail: "We can sync to Attio today, but we still need a first-party CRM read adapter for pulling closed-won cohorts and account opportunity state.",
      },
      {
        area: "Lookalike company provider",
        status: "native",
        detail: "Ocean is now wired as a first-party provider for lookalike company search; what remains is deterministic orchestration from CRM cohort selection into the search request.",
      },
      {
        area: "Account-to-persona finder",
        status: "native",
        detail: "Ocean is now wired as a first-party provider for lookalike people and persona discovery.",
      },
      {
        area: "Seed cohort scoring stage",
        status: "placeholder",
        detail: "The existing qualification stack can be repurposed, but the repo does not yet persist seed-account segmentation as a dedicated lifecycle stage.",
      },
    ],
  };
}
