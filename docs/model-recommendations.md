# Model Routing

Trellis should route models through the stack default, not through app-specific provider glue.

The public principle is simple:

- cheap structured calls for classification and policy checks
- stronger bounded-turn models for research and qualification
- premium fallback for high-value prospects or weak evidence
- model usage visible through the gateway and audit trail

## Recommended Shape

```text
classification -> small structured model
qualification  -> reliable reasoning model
research brief -> reliable tool-use model
copy drafting  -> balanced drafting model
fallback       -> premium model
```

The exact provider can change over time. The Trellis product contract should not.

## Trellis Responsibilities

Trellis should expose:

- a default model profile
- stage-level overrides
- fallback policy
- cost and latency metadata
- audit events for model-sensitive decisions

Trellis should not force every user to understand provider-specific model routing before their first deploy.

## Cloudflare Role

Cloudflare AI Gateway is the default routing and visibility layer.

Use it for:

- provider routing
- usage visibility
- latency tracking
- retries and fallbacks where available
- future guardrail and caching policy
