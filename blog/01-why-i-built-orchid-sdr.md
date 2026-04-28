# Why I Built Trellis

I built Trellis because the AI SDR market kept bothering me.

Not because the idea was bad.

The idea is obvious. Of course software should be able to monitor public signals, understand whether someone is relevant, research the account, and help start the right conversation.

What bothered me was how most products in the category actually felt.

They were expensive. Opaque. Weirdly rigid. Full of UI. Full of claims. Full of language about autonomy and scale. And then once you looked closely, a lot of them felt like sequencing software with a prompt bolted onto the side.

That is not the same thing as an AI-native SDR.

The real work in outbound is not the email editor. It is the judgment system behind the email:

- what should count as a signal
- which signals matter for this ICP
- whether the person is actually a fit
- whether the company is actually a fit
- whether the timing is real
- what angle is credible
- when not to send
- when to hand off

If that layer is weak, everything downstream is weak.

You can have the nicest sending UI in the world and still produce junk.

I wanted the opposite.

I wanted something that behaved more like infrastructure than software theater.

Something that could:

- wake up on a schedule
- decide what to go search for
- bring in signals from public sources
- normalize them into one contract
- research the post, the person, the company, and recent news
- qualify against a living ICP document
- persist the reasoning, evidence, and state
- and only then decide whether to draft, send, pause, or hand off

I also wanted it to be inspectable.

That part matters more than most people admit.

If the system says a lead is qualified, I want to know why.
If it pauses a thread, I want to know why.
If it syncs a company into the CRM, I want to know why.
If it sends an email, I want the entire trail.

That means:

- explicit workflows
- durable state
- typed tools
- first-party adapters
- a real database
- and an operator surface that is not just a pretty dashboard

That is why Trellis ended up with actors, MCP tools, Postgres, sandboxed turns, and CRM sync.

The architecture is the product.

Another reason I built it was frustration with lock-in.

Most commercial AI SDR tools assume you should accept all of these as a package deal:

- their source layer
- their qualification logic
- their memory model
- their email engine
- their CRM assumptions
- their operator interface

That is backwards.

A real outbound system should be composable.

You should be able to change:

- the model
- the research provider
- the sending layer
- the CRM target
- the discovery source
- the ICP

without rewriting the entire system.

That is how modern AI software should feel.

So Trellis started with one core idea:

build the SDR as a control plane, not a feature.

The result is a system that feels less like “AI wrote an email” and more like “there is now a real piece of software operating the top of funnel.”

That is what I wanted to prove.

And I think that is what the market actually needs.
