# The Harness Lineage: Pi, the Other Trellis, and What We Are Actually Building

There is a category of tool that has quietly become important in the last year:

the agent harness.

The harness is not the model. It is not the IDE. It is not the chatbot UI.

It is the runtime layer that decides:

- how the agent loads context
- how it discovers tools
- how it persists state
- how it is extended
- how it is shared between humans and machines

Two projects in this space are worth taking seriously, because they sit very close to what Trellis is doing in the SDR domain.

The first is [Pi](https://pi.dev), a minimal terminal coding harness.

The second is the other [Trellis](https://github.com/mindfold-ai/trellis), an agent harness from Mindfold that bills itself as "the best agent harness."

Yes, the name collision is unfortunate. We will address it directly below.

## A Quick Note On The Name

There are now two things called Trellis.

- Mindfold's Trellis is a multi-platform coding agent harness. It standardizes how AI coding agents work inside a repo by adding layered specs, task context, workspace memory, and platform-aware workflow wiring across tools like Claude Code, Cursor, Codex, Gemini CLI, Windsurf, and others.
- Our Trellis is a self-hostable AI SDR control plane. It turns signals into qualified pipeline through explicit, configurable workflow stages.

Different domain. Same instinct.

The instinct is that the harness is the product, not the model.

## What Pi Got Right

Pi is interesting because of what it leaves out.

It does not ship MCP. It does not ship sub-agents. It does not ship a permissions popup. It does not ship a built-in todo list. It does not ship background bash.

Instead, the core is small and the extension surface is the product:

- extensions are TypeScript modules
- skills follow the Agent Skills standard
- prompt templates are reusable Markdown
- themes are hot-reloadable
- everything ships as Pi packages over npm or git

That is a strong design statement.

It is saying that the harness should not pretend to know what your workflow is. It should know how to be extended.

That is the same argument we have been making about AI SDRs.

The opaque box that bundles sourcing, qualification, sending, replying, and CRM into one runtime is the wrong shape.

The harness is the right shape.

## What Mindfold's Trellis Got Right

The other Trellis tackles a different problem.

A coding agent on its own forgets. It does not know your spec. It does not know your conventions. It does not remember the last session.

Mindfold's Trellis fixes that with four layers:

1. Layered specs in `.trellis/spec/` that get injected into every session
2. Task context in `.trellis/tasks/` that keeps work structured and discoverable
3. Workspace memory in `.trellis/workspace/` that preserves session outcomes
4. Platform-aware workflow files generated for each enabled agent

The implication is important.

The repo is the source of truth. The agent is a temporary interpreter. The harness is the bridge that makes them line up.

That mental model maps almost one-to-one onto how Trellis-the-SDR is built.

## The Shared Primitives

When you put Pi, Mindfold's Trellis, and our Trellis next to each other, the same primitives keep showing up:

- the repo holds the durable behavior
- skills are the unit of repeatable capability
- specs and policies are versioned in code
- the agent runtime is replaceable
- extensions and providers are composable
- state is persisted between sessions, not re-derived from prompts

That is not a coincidence.

It is what happens when you take the harness seriously instead of treating it as a thin wrapper around a model call.

The model is not the product.

The harness, the skills, and the workflow shape are the product.

## How This Maps To Trellis

We have been making this argument across several earlier posts:

- the [Claude-style harness model](05-why-the-claude-code-harness-matters.md) is what makes Trellis cheap to extend
- the [composable architecture](04-why-composability-beats-monolithic-ai-sdrs.md) is what makes it durable as the stack changes
- the repo-managed ICP, policies, and skills are what make its behavior inspectable

Pi and Mindfold's Trellis are the same instinct, applied one layer down.

They are about the coding loop. We are about the SDR loop.

They make agents safe and useful inside a repo. We make agents safe and useful inside a top-of-funnel pipeline.

The translation is direct:

- their `.trellis/spec/` is our repo-managed ICP and qualification policy
- their task context is our workflow stage state
- their workspace memory is our durable run history and reasoning trail
- their platform-aware workflow is our provider composability across Firecrawl, Apify, Prospeo, AgentMail, Attio, Slack, and others
- their skills layer is our skills layer

The interesting part is that none of this has to be invented twice.

If pi.dev keeps being a good place to land for coding agents, and Mindfold's Trellis keeps being a good place to land for repo-aware coding workflows, then the SDR layer should look like a sibling of those, not a competitor.

## Why The Lineage Matters

There is a temptation in the AI SDR category to build everything as one closed application.

The lineage from Pi and Mindfold's Trellis tells you why that is the wrong move.

The teams building serious agent infrastructure are converging on a shared shape:

- minimal core
- skill-based extension
- repo as source of truth
- durable session state
- platform and provider composability
- explicit workflow surfaces

That is true whether the agent writes code or runs outbound.

Trellis-the-SDR is not trying to be a clever exception to that pattern.

It is trying to be the GTM-shaped instance of that pattern.

That is the bet.

The harness is the abstraction that wins.

The workflow shape is what makes a particular harness useful for a particular job.

For coding, that is Pi and Mindfold's Trellis.

For outbound, that is us.
