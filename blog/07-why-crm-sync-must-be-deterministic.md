# Why CRM Sync Must Be Deterministic

If an AI SDR touches the CRM, that write path should be deterministic.

This is one of those things that sounds obvious until you look at how many AI products still handle it like an afterthought.

## The Wrong Way

The wrong way to do CRM sync is:

- let the model decide when something “probably” belongs in the CRM
- let the model decide what fields “seem right”
- let the model create records without durable IDs
- hope duplicates do not become a problem later

That works exactly long enough to create a mess.

## CRM Is A Business System

The CRM is not just another place to dump generated text.

It is where companies expect:

- identity consistency
- stage consistency
- ownership
- traceability
- idempotency

That means the write path needs real rules.

## What Deterministic Sync Looks Like

In Trellis, the CRM path is treated as a first-party tool, not a side effect of a prompt.

That means:

- explicit company upsert
- explicit person upsert
- explicit note creation
- explicit list or pipeline insertion
- explicit stage setting
- explicit main point of contact setting

And importantly:

- persisted provider record IDs
- stable dedupe order
- clear warnings when the source data is weak

That is what makes the sync usable over time.

## Why Hooks Are Not Enough

This is where people often ask:

“Couldn’t you just use a Claude Code hook after a send?”

You can use a hook for some local automation.

But a CRM write that matters should live in the backend control plane, not just inside one local Claude session.

Why?

Because the send might come from:

- a scheduled workflow
- a dashboard action
- a remote MCP tool
- a local agent session

The CRM write should happen regardless of which entry point triggered the business event.

That is why deterministic backend sync beats client-side cleverness.

## Why This Matters For Trust

If the CRM is messy, the whole product becomes harder to trust.

Teams start asking:

- did we already contact this company?
- is this the right person?
- why are there duplicate records?
- why is this company in the wrong stage?
- what exactly was synced?

Once those questions start happening, the “AI” story stops mattering.

Now the product is just creating operational debt.

That is why CRM sync must be deterministic.

The AI can help decide what is worth doing.

But the actual write path should behave like infrastructure.
