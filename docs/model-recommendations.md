# Model Recommendations

Last reviewed: April 26, 2026

This note captures model recommendations for Trellis based on the product and workflow that exist in this repo today.

It is not a generic "best LLM for coding" memo.

It is specific to a composable, agentic GTM control plane that:

- ingests signals
- qualifies leads
- builds research briefs
- drafts outbound
- handles replies and handoff
- syncs CRM state
- exposes internal tools through MCP

## Product Context

The current commercial target in this repo is PlayKit.

PlayKit is positioned as a Clay-native expertise layer for GTM engineers, RevOps teams, agencies, and agent builders who need:

- better workflow design
- better provider choices
- better documentation
- better operational confidence
- MCP-native composability with agent stacks

The relevant source files are:

- [README.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/README.md:1)
- [docs/agent-native-architecture.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/docs/agent-native-architecture.md:1)
- [docs/framework-primitives.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/docs/framework-primitives.md:1)
- [knowledge/product.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/knowledge/product.md:1)
- [knowledge/icp.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/knowledge/icp.md:1)
- [knowledge/usp.md](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/knowledge/usp.md:1)

## Workflow Shape

The important architectural point is that Trellis is a staged workflow, not a single autonomous long-running agent.

The repo primarily runs many short or medium-length turns that:

- use tools
- read repo knowledge and skills
- return strict JSON
- commit state between stages
- need predictable cost and latency

The key stages are visible in:

- [src/orchestration/prospect-workflow.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/src/orchestration/prospect-workflow.ts:498)
- [src/orchestration/discovery-coordinator.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/src/orchestration/discovery-coordinator.ts:928)

That means model selection should optimize for:

- reliable structured output
- bounded-turn tool use
- grounded research synthesis
- low hallucination in qualification
- cost across repeated workflow steps
- stable latency for operators

## Current State

Today the repo uses `moonshotai/kimi-k2.6` in both main lanes:

- structured object generation in [src/services/ai-service.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/src/services/ai-service.ts:59)
- sandbox turns in [src/orchestration/sandbox-broker.ts](/Users/brandonguerrero/Documents/Orchid%20Automation/Orchid%20Labs/orchid-sdr/examples/ai-sdr/src/orchestration/sandbox-broker.ts:22)

This is simple, but too blunt for the actual workflow shape.

## Findings

### Kimi K2.6

`moonshotai/kimi-k2.6` is credible, but it appears better aligned to long-horizon coding and polished code/design generation than to Trellis's repeated bounded GTM turns.

It is not a bad default, but it is probably not the best default for this repo.

Sources:

- [Kimi K2.6 model page](https://vercel.com/ai-gateway/models/kimi-k2.6)
- [Kimi K2.6 changelog](https://vercel.com/changelog/kimi-k2.6-on-ai-gateway)

### GLM 5.1

`zai/glm-5.1` is the most interesting GLM model if the goal is long-horizon autonomous execution.

That is not the primary shape of Trellis.

Trellis intentionally breaks work into controlled stages with state commits between them, so GLM 5.1 is more useful as a niche experimental lane than as the global default.

Sources:

- [GLM 5.1 model page](https://vercel.com/ai-gateway/models/glm-5.1)
- [GLM 5.1 changelog](https://vercel.com/changelog/glm-5.1-on-ai-gateway)

### GLM 5

`zai/glm-5` is a better GLM fit for Trellis than GLM 5.1.

It still targets agentic workflows and tool use, but it is a better match for research and qualification turns that complete in minutes rather than hours.

Best use here:

- research brief generation
- qualification experiments
- optional A/B lane against the default sandbox model

Source:

- [GLM 5 model page](https://vercel.com/ai-gateway/models/glm-5)

### MiniMax M2.7

`minimax/minimax-m2.7` looks like the best fit from the GLM and MiniMax set for Trellis's main workflow.

Why:

- strong bounded-turn agentic behavior
- good fit for repeated research and drafting loops
- better match for stage-based execution than long-horizon autonomy
- relevant support for file input and vision in sandbox-style workflows

Best use here:

- sandbox qualification
- research brief generation
- first outbound drafting
- reply or handoff drafting

Sources:

- [MiniMax M2.7 model page](https://vercel.com/ai-gateway/models/minimax-m2.7)
- [MiniMax M2.7 changelog](https://vercel.com/changelog/minimax-m2.7-on-ai-gateway)

### MiniMax M2.5

`minimax/minimax-m2.5` looks like a good cheaper worker lane for smaller structured tasks.

Best use here:

- reply classification
- policy checks
- discovery planning
- lower-stakes structured generation

Sources:

- [MiniMax M2.5 model page](https://vercel.com/ai-gateway/models/minimax-m2.5)
- [MiniMax M2.5 changelog](https://vercel.com/changelog/use-minimax-m2-5-on-ai-gateway)

### Claude Sonnet 4.6

`anthropic/claude-sonnet-4.6` remains the safest premium fallback if the priority is harness reliability, strong judgment, and recovery from parse or quality failures.

Best use here:

- fallback on sandbox parse failure
- fallback on weak evidence
- premium routing for high-value leads

Source:

- [Claude Sonnet 4.6 model page](https://vercel.com/ai-gateway/models/claude-sonnet-4.6)

## Recommendation

Do not use one model for every workflow stage.

For Trellis as it exists today, the recommended routing is:

- primary sandbox model: `minimax/minimax-m2.7`
- experimental research lane: `zai/glm-5`
- cheap structured lane: `minimax/minimax-m2.5` or `openai/gpt-5.4-mini`
- premium fallback: `anthropic/claude-sonnet-4.6`

## Ranking For This Repo

Based on the current product and workflow shape, the recommended order is:

1. `minimax/minimax-m2.7`
2. `zai/glm-5`
3. `moonshotai/kimi-k2.6`
4. `zai/glm-5.1` as a niche lane, not a default

## Practical Routing Plan

Recommended routing by stage:

- sandbox workflow turns:
  `qualify`, `build_research_brief`, `first_outbound`, `respond_or_handoff`
  Use `minimax/minimax-m2.7`

- structured calls:
  `classifyReply`, `policyCheck`, discovery planning
  Use `minimax/minimax-m2.5` or `openai/gpt-5.4-mini`

- fallback path:
  On parse failure, thin evidence, or high-value leads, fall back to `anthropic/claude-sonnet-4.6`

- research experiments:
  Use `zai/glm-5` behind a flag for A/B testing on research-brief quality

## Bottom Line

Trellis is a composable agentic GTM system, not a single long-running autonomous coding agent.

That means the best model is not the one that looks most impressive in long-horizon autonomy demos.

The best model is the one that performs reliably across many tool-using, stateful, bounded workflow steps.

For that reason, `minimax/minimax-m2.7` is the strongest primary candidate from the GLM and MiniMax set, with `zai/glm-5` as the most relevant GLM to test and `claude-sonnet-4.6` as the safest premium fallback.
