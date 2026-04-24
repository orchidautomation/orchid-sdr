# LinkedIn Post Draft

I think the AI SDR market is about to get rewritten.

In the last 8 hours, I built an AI-native SDR system that:

- wakes up on a schedule
- reads an ICP doc
- decides what kinds of signals to search for
- uses Apify to find public LinkedIn signals
- researches the post, the person, the company, and company news
- qualifies the person and company against the ICP
- stores the reasoning, confidence, and evidence in Postgres
- syncs qualified companies and contacts into Attio
- exposes the whole pipeline through a dashboard and an MCP control plane

The part I find most interesting is not the email.

It is the architecture.

Most "AI SDR" products feel bloated, opaque, and weirdly fragile. They are usually:

- a sequence tool with a prompt stapled on
- a black-box qualification layer
- a vendor-locked source pipeline
- a giant price tag for something you cannot really inspect or extend

This is the opposite.

It is built like infrastructure:

- Rivet actors for durable state and scheduling
- sandboxed Claude-style agent turns
- Vercel AI Gateway for model routing
- Apify for discovery
- Firecrawl for research
- Postgres as the system of record
- MCP tools for operator control

And because it uses the Claude Code-style harness model, adding new MCPs and skills is cheap.

That matters a lot.

It means you can keep improving the agent instead of rebuilding the product every time you want one more capability.

Also, LinkedIn is just one source adapter.

The system already supports generic normalized signal webhooks, so anything that can emit structured signals can enter the same qualification and research pipeline.

That means X is next.

Sending is still intentionally off.

Right now the system is doing the right first job:

- find leads
- research them
- qualify them
- write them to the database and CRM

Trust the reasoning layer first.
Then trust the send button.

If you’re building in this category, I think the takeaway is simple:

AI SDRs should be agent-native, composable systems.

Not bloated wrappers.

If people want, I’ll open-source the core of this.
