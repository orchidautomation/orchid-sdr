# The AI SDR Market Is Broken

Most AI SDR products on the market today are bloated, expensive, and architecturally backward.

They sell the dream of autonomous outbound, but most of what you actually get is:

- a thin UI over brittle workflows
- a black-box prospecting engine you cannot inspect
- generic copy that sounds AI-generated from the first sentence
- limited source coverage
- weak qualification logic
- and pricing that assumes you should pay enterprise money for what is often just stitched-together automation

That is the part that bothered me most.

The market is full of companies charging an arm and a leg for systems that still feel like glorified sequencers with a prompt bolted onto the side.

If you are serious about outbound, that is not enough.

You do not want:

- one vendor-controlled list source
- one opaque qualification layer
- one opinionated email engine
- one hidden memory model

You want infrastructure.

You want a system that can:

- wake up on a schedule
- decide what to search for
- monitor public signals across multiple channels
- research a real person and their company
- qualify against your actual ICP
- persist its reasoning
- and optionally hand off or send when you are ready

That should be software, not theater.

## What Is Wrong With AI SDRs Today

Most current AI SDR products are built as if the core problem is "send more emails automatically."

It is not.

The real problem is upstream:

- finding the right signal
- understanding whether that signal matters
- knowing whether the person is actually a fit
- knowing whether the company is actually a fit
- understanding timing
- and doing all of that in a way you can inspect, tune, and trust

That means the hard part is not the email.

The hard part is the decision system behind the email.

Most products invert that. They over-invest in surface area and under-invest in reasoning, state, and source quality.

So you end up with:

- giant dashboards
- inflated seat pricing
- shallow prospect qualification
- weak personalization
- and almost no real control over the pipeline

## The Better Way To Build One

An AI SDR should be AI-native software.

That means:

- actors for durable state
- explicit workflows
- composable tools
- inspectable persistence
- model-agnostic reasoning
- and source adapters that can be swapped without rewriting the whole product

That is exactly what I built.

In about eight hours.

Not a demo.

A real working system.

## What This AI SDR Actually Does

The system wakes up on a schedule and starts from the ICP itself.

It reads `icp.md`, decides what kinds of signals are worth searching for, and launches discovery runs.

Today that discovery layer uses Apify, which means it can monitor public LinkedIn now and public X next without changing the core workflow.

It can also ingest normalized signal batches from arbitrary sources through a generic webhook, which means LinkedIn is just one source adapter, not the architecture.

From there, each candidate moves through a real pipeline:

1. discover the signal
2. normalize and persist it
3. fetch the original post
4. fetch the person profile
5. fetch the company page
6. search for relevant company news
7. qualify the person, company, and signal against the ICP
8. store the reasoning, confidence, and evidence in Postgres
9. optionally enrich email and send later

Right now, sending is disabled on purpose.

That means the system is running in append-only mode:

- wake up
- find leads
- research them
- qualify them
- write them to the database

That is exactly the right place to start.

You should trust the intelligence layer before you trust the send button.

## The Stack

This is what made it possible to build quickly without building something fragile:

- `RivetKit` for durable actors, scheduling, and actor-local state
- `Vercel AI Gateway` for model routing
- `sandbox-agent` plus Vercel Sandboxes for tool-using reasoning turns
- `kimi-k2.6` for the reasoning layer
- `Apify` for signal discovery
- `Firecrawl` for post, profile, company, and news research
- `Postgres` as the inspectable system of record
- `Hono` for the control plane and webhooks

The important part is not just the tools.

It is the shape of the system.

Everything is modular.

Discovery is separate from qualification.
Qualification is separate from research.
Research is separate from sending.
Sending is separate from handoff.

That is what makes it scalable.

It is also what makes it composable.

Because the reasoning runtime is using the Claude-style harness inside the sandbox, the system inherits the same basic extension model that makes Claude Code workflows powerful in the first place:

- add another MCP
- add another skill
- tighten one workflow
- improve one decision surface

You do not have to redesign the whole product every time you want the agent to do one more useful thing.

That matters a lot.

Most AI SDR products feel rigid even when they market themselves as autonomous.

This is the opposite.

The stack is intentionally agent-native, so adding another tool, another research source, another internal playbook, or another qualification skill is cheap.

## Why This Matters

The AI SDR category does not need more wrappers.

It needs open, inspectable systems that companies can actually own.

A serious outbound engine should not require surrendering your source layer, your qualification logic, your research stack, your data model, and your sending lane to one vendor.

It should look more like infrastructure:

- bring your own sources
- bring your own ICP
- bring your own sending layer
- bring your own CRM
- inspect every decision
- change any part without replacing the whole thing

That is the real promise of agentic software.

Not "AI wrote a cold email."

Real systems that reason, persist state, and improve how companies operate.

And if the harness is right, they stay easy to extend.

## Why The Incumbents Look Wrong

A lot of incumbents in this category were designed in the wrong era.

They were built before:

- durable actor runtimes were easy to use
- tool-using sandbox agents were practical
- model gateways made routing flexible
- research stacks like Firecrawl were reliable enough to compose

So they compensate with:

- more UI
- more pricing tiers
- more manual setup
- more proprietary lock-in

The result is a category full of expensive software that still does not feel native to how modern AI systems should be built.

## The Point

If this much can be built in eight hours with modern AI-native infrastructure, then the category is going to get rewritten.

Not because outbound suddenly became easy.

But because the stack finally caught up to the problem.

The interesting companies in this space will not be the ones with the most polished sequence builder.

They will be the ones that build:

- better signal loops
- better qualification systems
- better research pipelines
- better memory
- better handoffs
- and more open architecture

That is the real product.

Everything else is packaging.

## What Comes Next

The next steps are straightforward:

- add more discovery sources like X
- expand CRM sync
- enable sending when the qualification quality is proven
- add better re-scoring and operator views
- keep the entire system modular and inspectable

That is how you build an AI SDR that a real company can scale on.

Not by hiding the logic.

By making the logic the product.
