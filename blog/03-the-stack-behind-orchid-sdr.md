# The Stack Behind Orchid SDR

The interesting part of Orchid SDR is not just that it uses AI.

The interesting part is the way the stack is composed.

Every major piece has a clear job.

## Rivet For Durable State And Scheduling

The discovery loop is stateful.

It needs to remember:

- what terms it already tried
- what produced useful signals
- what source is currently healthy
- when to wake up next

That is why the top of the system runs on Rivet actors.

Rivet gives Orchid SDR:

- durable actors
- persistent scheduling
- actor-local SQLite
- workflow boundaries that are explicit instead of implied

This is a much better fit than a plain cron job plus a few background functions.

## Vercel Sandbox And The Claude-Style Harness

The reasoning lane runs inside turn-scoped sandboxes.

That matters for two reasons:

1. the agent can use tools, skills, MCP servers, and repo context the way a real coding agent does
2. the runtime is modular enough that adding capabilities later is cheap

This is where the “Claude Code harness” point becomes important.

The harness model gives you a mature pattern for:

- skills
- tool use
- MCP
- hooks
- project-scoped context

That means Orchid SDR is not inventing its own fragile agent runtime from scratch.

It is inheriting a much better extension model.

## Vercel AI Gateway For Model Routing

The model should not be the architecture.

That is why Orchid SDR routes model calls through Vercel AI Gateway.

Today it can use `moonshotai/kimi-k2.6`.
Tomorrow it can use something else.

That matters because AI infrastructure changes fast.

The system should let you change the model without changing the product.

## Apify For Discovery

Discovery is its own layer.

Right now that layer uses Apify to pull public signals from LinkedIn, and it can expand to X or other sources later.

The important part is that Apify is a source adapter, not the center of the product.

Signals come in, get normalized, and then the rest of the system takes over.

That means one source can be swapped without rewriting qualification or research.

## Firecrawl For Research

Discovery gives you candidates.

It does not give you enough context to draft credible outreach.

That is where Firecrawl fits.

For each lead, Orchid SDR can research:

- the original post or source page
- the person profile
- the company site
- recent company news

That turns the system from “lead scraper” into “research-backed qualifier.”

It also means the copy system has something real to work with besides one noisy source event.

## Postgres As The Shared System Of Record

A serious SDR system needs a real database.

Postgres stores:

- signals
- prospects
- threads
- research briefs
- messages
- audit events
- provider runs

That is what makes the whole thing inspectable.

Without this layer, you do not really have an operating system.

You just have a prompt that ran.

## AgentMail And Attio As Provider Boundaries

Email and CRM are business systems.

They should not be hidden inside model calls.

That is why Orchid SDR keeps them behind adapters:

- AgentMail for sender identity, send, reply, and inbound events
- Attio for deterministic CRM sync

The system can still be agentic without becoming sloppy.

That is the key distinction.

## Why The Shape Matters

This stack works because the responsibilities are separated:

- Rivet handles time and state
- Sandbox handles reasoning
- AI Gateway handles model routing
- Apify handles discovery
- Firecrawl handles research
- Postgres handles memory and audit
- AgentMail handles email
- Attio handles CRM

That is the real lesson.

The point is not that these are the only tools that could work.

The point is that modern AI software gets much better when every layer has a clear job.
