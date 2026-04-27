# Trellis Positioning

## What Trellis Is

Trellis is a self-hostable AI SDR control plane.

It is the orchestration layer for turning inbound or discovered signals into:

1. qualified prospects
2. research context
3. enrichment
4. outbound drafts
5. reply handling
6. handoff
7. CRM and state updates

The system is workflow-first, not chatbot-first.

## What Trellis Is Not

Trellis is not:

- another outbound sequencer
- a prompt wrapper around one model call
- a black-box "AI SDR" with hidden workflow logic

The point is explicit, inspectable runtime behavior.

## Core Framing

The cleanest one-line description:

> Trellis is a self-hostable AI SDR control plane for turning signals into qualified pipeline through explicit, configurable workflow stages.

Other good framings:

- AI SDR, but as infrastructure
- a control plane for signal-driven outbound
- repo-managed AI SDR workflows
- composable AI SDR orchestration, not black-box automation

## Why It Matters

Most AI SDR products compress too much business logic into one opaque agent surface.

Trellis breaks the workflow into explicit stages:

- discovery
- qualification
- research
- enrichment
- outbound
- reply classification
- handoff

That makes the system:

- inspectable
- configurable
- versioned
- provider-composable
- more credible in production

## What Actually Differentiates Trellis

### 1. Workflow-first architecture

The product is organized as explicit stages with real state and checkpoints, not just a single conversational agent loop.

### 2. Provider composability

Different parts of the workflow can use different providers:

- Apify for source discovery
- Firecrawl for search and extract
- Prospeo for enrichment
- AgentMail for email
- Attio for CRM sync
- Slack for handoff
- Rivet for actor orchestration
- Vercel Sandbox for sandboxed task execution

### 3. Repo-managed operating logic

ICP, policy, knowledge, and workflow behavior live in the repo.

That means the actual GTM logic is inspectable software instead of hidden product behavior.

### 4. Self-hostable control plane

Trellis should behave more like infrastructure than a closed SaaS agent.

## Public Language

### Short version

> I’ve been building Trellis, a self-hostable AI SDR control plane. It takes signals from sources like public posts and webhooks, qualifies them against a repo-managed ICP, builds research context, enriches contact data, drafts outbound, and routes replies and handoffs through explicit workflow stages.

### Technical version

> Trellis is a composable AI SDR runtime. Instead of treating AI SDR as one opaque agent, it breaks the system into explicit stages: discovery, qualification, research, enrichment, outbound, reply classification, and handoff. Each stage can use different providers, different models, and different policies. ICP, compliance, and workflow behavior all live in code.

### Opinionated version

> Most AI SDR products are still selling magic. Trellis is the opposite direction: a self-hostable, composable, workflow-driven control plane for signal intake, qualification, research, outreach, and handoff.

## Best Internal Summary

If the product needs one sentence to anchor docs, posts, or future landing-page copy, use this:

> Trellis is a self-hostable AI SDR control plane for turning signals into qualified pipeline through explicit, configurable workflow stages.
