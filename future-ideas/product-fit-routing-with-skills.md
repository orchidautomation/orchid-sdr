# Product-Fit Routing With Skills

## Status

Future idea. Not committed to the current Orchid SDR production path yet.

## Short Version

Orchid SDR could become more useful for multi-product companies by adding a product-fit routing layer before qualification and outreach.

Instead of assuming every inbound or discovered lead should be evaluated against one ICP, the system would first determine what the company appears to sell, what the person likely owns, what pain or buying signal is visible, and which product or offer is the best fit.

Skills would not directly "talk to other skills." A coordinator would call specialized skills in sequence and require structured outputs at each step.

## Example Scenario

A warm lead submits a HubSpot form.

The form only gives partial context:

- email address
- name
- company
- optional message
- source campaign or landing page

Orchid SDR enriches the lead, researches the person and company, then asks:

- What does this company likely sell?
- What GTM motion do they appear to use?
- What role does this person probably play?
- What problem are they likely trying to solve?
- Which Orchid product or service is the strongest fit?
- Is the evidence strong enough to qualify automatically, or should a human review it?

## Proposed Flow

1. Capture the lead from HubSpot, webhook, manual upload, or another warm source.
2. Normalize it into the existing signal/prospect/thread model.
3. Enrich the person and company.
4. Build a compact research brief.
5. Run a company diagnosis skill.
6. Run a product-fit router skill.
7. Run one or more product-specific ICP skills.
8. Run a qualification judge that compares candidates.
9. Choose one of:
   - qualified for a specific product
   - nurture / ambiguous
   - disqualified
   - route to human
10. Draft outreach or handoff notes using the selected product context.

## Skill Shape

The likely skill set:

- `company.diagnose`
  Infers the company's product, customer, GTM motion, business model, and visible operating constraints.

- `product.match`
  Maps company, person, source, and pain evidence to the internal product catalog.

- `icp.<product>`
  Evaluates fit for a specific product or offer.

- `qualification.judge`
  Compares candidate products and decides whether the lead is qualified, rejected, ambiguous, or needs human review.

- `copy.first-touch`
  Writes product-aware outreach based only on the evidence collected.

- `handoff.policy`
  Decides whether to send, pause, route to a human, sync CRM, or request more research.

## Structured Output Requirement

Each step should return structured data, not only prose.

Example product-fit output:

```json
{
  "recommendedProduct": "playkit",
  "confidence": 0.82,
  "evidence": [
    "company appears to operate Clay workflows",
    "lead mentioned enrichment automation",
    "person owns GTM systems"
  ],
  "disqualifiedProducts": [
    {
      "product": "orchid-sdr",
      "reason": "no evidence they want autonomous outbound"
    }
  ],
  "nextAction": "draft_first_outbound"
}
```

Example qualification output:

```json
{
  "decision": "qualified",
  "product": "playkit",
  "confidence": 0.78,
  "reason": "Warm lead shows active Clay workflow pain and appears to own GTM operations.",
  "requiredHumanReview": false,
  "missingEvidence": [
    "current enrichment volume",
    "existing Clay credit waste"
  ]
}
```

## Product Catalog

Skills should not be the only place product facts live. Product definitions should come from a structured catalog so the agent has a stable source of truth.

Possible catalog fields:

- product name
- short description
- ideal company profile
- ideal buyer / operator
- pains solved
- negative fit signals
- required evidence before qualification
- proof points
- allowed claims
- disallowed claims
- default next action

The catalog gives the agent facts. Skills teach judgment.

## Why This Matters

This would let Orchid SDR handle more realistic inbound and outbound situations:

- one company selling multiple products
- agencies with multiple service lines
- leads with unclear intent
- warm leads that need product routing before sales follow-up
- discovered accounts that might fit one offer but not another

It also reduces bad outbound because the agent has to explain why a product was selected before it can draft or send anything.

## Guardrails

Useful guardrails:

- require evidence citations for every product recommendation
- reject if all product matches are weak
- route to human when two products score closely
- keep no-sends mode as the default until the routing path is proven
- store all intermediate decisions in the audit log
- separate product facts from copywriting instructions
- keep product-specific claims in allowlists

## Data Model Ideas

Potential future tables or JSON fields:

- `product_catalog`
- `lead_product_matches`
- `qualification_runs`
- `decision_evidence`
- `handoff_recommendations`

This could also start as JSON on the existing prospect/thread records before becoming first-class tables.

## MCP Surface Ideas

Possible future tools:

- `lead.routeProduct`
- `lead.productMatches`
- `lead.qualifyForProduct`
- `catalog.products`
- `catalog.productContext`
- `qualification.compareProducts`
- `handoff.recommend`

## Open Questions

- Should product routing happen for every lead, or only warm inbound and ambiguous accounts?
- Should a lead be allowed to qualify for multiple products at once?
- How should product conflicts be resolved when two products look plausible?
- Should product catalog edits be code-reviewed, operator-managed, or stored in a database?
- What confidence threshold is high enough for automatic outreach?
- What evidence must be present before the system is allowed to mention a product-specific claim?

## Possible First Implementation

Start small:

1. Add a static product catalog in `knowledge/products/`.
2. Add one product-router skill that emits structured JSON.
3. Add one product-specific ICP skill for the highest-priority offer.
4. Add a manual MCP tool to route a single lead.
5. Save the routing result to the audit log.
6. Keep sending disabled for this path until reviewed with real examples.

This would prove the decision loop without changing the main outbound pipeline.
