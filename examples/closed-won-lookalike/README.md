# Closed-Won Lookalike Outbound

This example turns a best-customer closed-won cohort into a ready-to-contact outbound pipeline using Trellis primitives instead of a one-off demo path.

## Why This Exists

- proves Trellis can express a real GTM workflow, not only signal-first SDR discovery
- reuses the same actor, MCP, knowledge, and skills shape already present in the repo
- makes native support, thin adapter work, and placeholders explicit

## Workflow

| Step | Support | Current shape |
| --- | --- | --- |
| Pull closed-won deals | Adapter gap | Needs a first-party CRM read adapter even though Attio write sync already exists |
| Segment best customers | Placeholder | Uses an example overlay skill and knowledge pack in v1 |
| Find lookalike companies | Adapter gap | Best fit for a thin Ocean-style provider boundary |
| Identify personas | Adapter gap | Can reuse research primitives, but needs a dedicated account-to-persona adapter |
| Deduplicate against CRM | Adapter gap | Needs CRM read-side account and opportunity checks |
| Enrich accounts and contacts | Native | Reuses `research.search`, `research.extract`, and `email.enrich` |
| Upsert CRM pipeline | Native | Reuses `crm.syncProspect` and existing Attio list-stage support |
| Hand off ready pipeline | Native | Reuses pipeline views, no-sends mode, and handoff tools |

## Runtime Mapping

- Manifest: `examples/closed-won-lookalike/manifest.json`
- Example knowledge pack: `examples/closed-won-lookalike/knowledge/`
- Example skills: `examples/closed-won-lookalike/skills/`
- Existing actors reused: `discoveryCoordinator`, `sourceIngest`, `prospectThread`, `campaignOps`
- Existing state reused: campaigns, signals, prospects, threads, research briefs, contact emails, messages, audit events, provider runs

## Operator Flows

### CLI blueprint

```bash
npm run example:closed-won-lookalike -- --mode blueprint
```

Use this when you want the static package: workflow map, support levels, gaps, and the operator entry points.

### CLI live inspection

```bash
npm run example:closed-won-lookalike -- --mode operator
```

Use this when the backend is configured and you want campaign flags, discovery health, pipeline summary, and workflow feed in one output.

### MCP inspection

Use the first-party tool:

```json
example.closedWonLookalike({
  "includeRuntime": true
})
```

Then inspect live runtime state with:

```json
pipeline.summary({ "limit": 8 })
pipeline.workflowFeed({ "limit": 8 })
pipeline.qualifiedLeads({ "limit": 8 })
```

## Gap List

- CRM closed-won reader: not yet exposed through the first-party MCP surface
- Lookalike provider: still needs a thin company-expansion adapter
- Persona finder: still needs a dedicated account-to-buyer discovery adapter
- Seed cohort stage: qualification primitives exist, but best-customer segmentation is not yet persisted as its own lifecycle stage

## Recommended v1 Execution Model

1. Export or read a closed-won seed cohort from CRM.
2. Score and narrow the cohort using the example knowledge pack and segmentation skill.
3. Send the narrowed cohort into a lookalike provider boundary.
4. Discover personas, enrich them, and write prospects into Trellis.
5. Use `NO_SENDS_MODE=true` to review the resulting queue before any outbound.
6. Upsert the accepted prospects into Attio with a dedicated list stage or campaign tag.
