# Trellis GTM Agent Suite

Trellis is the trusted execution layer for go-to-market agents.

The core idea is simple: GTM teams should be able to build their own agents without trusting a black box, stitching together fragile scripts, or letting a model mutate revenue systems without a clear contract.

Trellis gives teams a turnkey agent stack with durable state, typed outputs, approval gates, audit trails, provider adapters, model routing, webhooks, queues, workflows, and smoke tests. The agent can be customized in markdown and TypeScript, but the reliability contract stays the same.

## What Trellis Owns

Trellis should own the things a GTM team cannot afford to improvise:

- **Signals**: normalized inputs from forms, product usage, Slack, email, CRM events, support tickets, warehouses, LinkedIn workflows, job changes, news, funding events, and enrichment jobs.
- **Threads**: one durable history per person, account, opportunity, campaign, inbox, or workflow. When someone replies three days later, Trellis wakes the same thread with the same context.
- **Knowledge**: markdown packs for ICP, positioning, products, competitors, compliance, playbooks, qualification rules, objection handling, and account strategy.
- **Skills**: repeatable agent procedures with typed outputs, such as qualification, research, copywriting, reply classification, routing, handoff, enrichment, dedupe, and forecast analysis.
- **State maps**: business-level table definitions for prospects, accounts, signals, campaigns, approvals, drafts, replies, workflows, and audit events.
- **Provider maps**: explicit mappings from Trellis outputs into external systems like CRMs, email providers, Slack, warehouses, and enrichment tools.
- **Tool contracts**: every tool is named, scoped, typed, logged, permissioned, and replayable. Trellis can ingest capability from MCPs, APIs, SDKs, or scripts, but exposes only Trellis-shaped tools.
- **Safety**: no-send mode, approval gates, idempotency keys, rate limits, blocked actions, replay protection, and human handoff rules.
- **Workflows**: durable multi-step processes for research, approval, send, wait, reply, follow-up, CRM sync, and escalation.
- **Observability**: traces, model calls, tool calls, provider calls, audit events, smoke runs, failure states, and cost/latency visibility.
- **Deployability**: one known-good runtime, one command to deploy, and a smoke test that proves the system is alive before real side effects are enabled.

The product boundary matters. Trellis is not "let the agent use every tool." Trellis is "turn messy GTM capability into trusted workflows that operators can inspect, approve, retry, and improve."

## The Primitive Stack

These are the primitives that compose into the GTM suite:

| Primitive | What It Does | Why GTM Teams Care |
| --- | --- | --- |
| `signal` | Accepts an event from any source and normalizes it | Every workflow starts from a clean business event |
| `thread` | Stores durable context for a person/account/workflow | Follow-up and replies do not lose history |
| `knowledge` | Loads company docs and GTM judgment from markdown | Operators can change behavior without rewriting code |
| `skill` | Runs a typed repeatable agent procedure | Agent outputs become structured business data |
| `state` | Defines business tables, fields, indexes, and relationships | The app remembers work in a queryable way |
| `provider` | Connects CRM, email, Slack, web research, data, and warehouses | Agents can act inside the actual GTM stack |
| `tool` | Exposes approved capabilities to the agent | Integrations stay safe, logged, and predictable |
| `approval` | Blocks risky actions until reviewed | No accidental sends or destructive CRM writes |
| `workflow` | Runs long-lived GTM processes with retries and waits | Prospecting and lifecycle work can span days or weeks |
| `audit` | Records decisions, tool calls, side effects, and approvals | Teams can debug, explain, and trust what happened |
| `smoke` | Runs deterministic readiness checks | Deployments prove themselves before touching customers |

## The Composition Pattern

Every Trellis workflow follows the same shape:

1. A signal arrives.
2. Trellis resolves the durable thread.
3. The agent loads relevant knowledge and prior context.
4. Skills produce typed outputs.
5. Provider tools gather evidence or prepare actions.
6. State is written through the state map.
7. Risky side effects become approval records.
8. Durable workflows wait, retry, escalate, or continue.
9. Audit events explain the entire path.
10. Smoke tests verify the loop still works.

That pattern is reusable across SDR, expansion, support-led growth, CRM hygiene, partner ops, and revenue intelligence.

## Suite Ideas

### 1. Signal-To-Meeting Agent

Turns inbound forms, product signals, community activity, newsletter replies, and LinkedIn opt-ins into qualified meeting opportunities.

The agent researches the person and account, scores fit, drafts a human-safe outbound or reply, blocks sends behind approval, writes state, and starts a follow-up workflow. If the prospect replies positively, the same thread wakes up and hands off to Slack or the CRM with the full context.

**Composed from**: signals, threads, knowledge, qualification skill, research tools, email provider, approval gates, workflow waits, audit events.

### 2. Reply Intelligence And Handoff Agent

Monitors replies across agent inboxes and classifies what happened: positive intent, objection, unsubscribe, referral, timing issue, pricing question, competitor mention, or meeting request.

Positive or nuanced replies trigger a human handoff with the original signal, qualification result, outbound draft, reply summary, risk notes, and recommended next step. The point is not to automate every reply; it is to make sure humans get the right context at the right moment.

**Composed from**: email webhooks, thread memory, reply-policy skill, handoff-policy skill, Slack provider, CRM task provider, audit trail.

### 3. Account Room Agent

Creates a living room for every target account.

The room keeps account research, signals, stakeholders, open questions, recent news, support context, product usage, prior outbound, replies, notes, and recommended plays in one place. Reps can ask "why this account?" or "what changed since last week?" and get an evidence-backed answer.

**Composed from**: account threads, R2 artifacts, knowledge packs, Firecrawl-style research, Slack/CRM/email providers, state maps, dashboard views.

### 4. Market Pulse Agent

Runs scheduled monitors for target accounts, competitors, categories, funding events, leadership changes, hiring plans, product launches, pricing pages, docs updates, and news mentions.

Instead of asking a rep to manually check the web, Trellis turns external change into normalized account signals. Every signal is source-linked, deduped, scored, and either ignored, queued for review, or routed into a campaign.

**Composed from**: schedules, web/news search providers, extraction tools, dedupe state, account scoring skill, queues, workflow routing.

### 5. Closed-Won Lookalike Agent

Starts from real customers and finds similar companies, buying committees, trigger events, and messaging angles.

This is not just "find companies like X." The agent explains why the company is similar, which buying motion it fits, what evidence supports the match, and what campaign or rep should own the next step.

**Composed from**: CRM provider, customer knowledge, enrichment provider, research provider, scoring skill, campaign state, approval queue.

### 6. Competitive Displacement Agent

Monitors public signals that suggest an account is using, evaluating, hiring for, complaining about, or migrating away from a competitor.

The output is a displacement brief: likely incumbent, pain hypothesis, proof, buyer persona, risk level, recommended angle, and blocked draft. It should never fabricate proof. Weak evidence becomes "watchlist," not outbound.

**Composed from**: competitor knowledge, web/news monitors, job-posting signals, support/community signals, qualification skill, copy skill, approval gates.

### 7. CRM Mutation Firewall

Lets agents propose CRM updates without letting them freely mutate the CRM.

The agent can enrich missing fields, normalize titles, dedupe companies, suggest lifecycle stage changes, create tasks, or attach research notes. Trellis maps every field through an explicit provider map and blocks sensitive writes for approval.

**Composed from**: CRM provider map, state map, validation schema, approval records, audit events, provider smoke tests.

### 8. Persona Map Agent

Builds a current buying committee map for a target account.

It identifies likely economic buyers, champions, admins, blockers, RevOps owners, GTM engineers, support leaders, security reviewers, and executives. It explains confidence, sources, and recommended engagement path.

**Composed from**: people enrichment, company research, LinkedIn-style sources, CRM state, persona knowledge, relationship graph state.

### 9. Pipeline Diagnosis Agent

Runs as a weekly or daily revenue ops job.

It looks at open pipeline and asks: where are deals stuck, which stages are leaking, which accounts have no next step, which opps changed risk, which reps need help, and which forecast notes do not match reality?

The output is not a dashboard full of charts. It is a prioritized action queue with receipts.

**Composed from**: CRM provider, warehouse queries, call transcript provider, Slack context, state maps, diagnosis skill, handoff workflow.

### 10. Campaign Experiment Agent

Runs outbound experiments with a strict safety and measurement contract.

It proposes hypotheses, target segments, message variants, stop conditions, approval requirements, and success metrics. After launch, it reads replies and outcomes, explains what worked, and recommends the next experiment.

**Composed from**: campaign state, email provider, copy skill, reply classifier, analytics provider, experiment workflow, audit trail.

### 11. Expansion Sentinel

Watches existing customers for expansion, risk, champion movement, product usage changes, support pain, hiring, launches, and organizational change.

When something meaningful happens, it produces a CSM/AE-ready brief and recommended action. The agent should help teams act earlier, not spam customers.

**Composed from**: product analytics, support provider, CRM, billing provider, news search, account thread, handoff skill.

### 12. Partner And Ecosystem Scout

Finds integration, agency, channel, and technology partners that match a GTM strategy.

The agent maps partner categories, identifies likely fit, finds evidence of overlapping audiences, drafts partner outreach, and tracks partner conversations as durable threads.

**Composed from**: web research, app directory scraping, CRM/account state, partner scoring skill, email draft approvals.

### 13. Deal Desk Prep Agent

Prepares account executives before pricing, procurement, security, or legal calls.

It pulls account context, stakeholder history, active objections, recent product/support context, competitive notes, open risks, and recommended negotiation posture. It can generate a concise briefing before the meeting and update the opportunity after.

**Composed from**: calendar trigger, CRM, call transcripts, docs, support tickets, account thread, briefing skill, CRM update approval.

### 14. Revenue Wiki Maintainer

Keeps GTM knowledge fresh by watching what reps actually ask, where agents fail, and which playbooks are stale.

It can propose updates to ICP docs, objection handling, competitor notes, routing rules, qualification rubrics, and messaging guidelines. Trellis should not let the model silently rewrite source-of-truth docs; it should open reviewed change proposals.

**Composed from**: audit logs, failed skills, Slack questions, markdown knowledge, approval workflow, docs provider.

### 15. Board Narrative Agent

Turns messy GTM activity into an explainable weekly or monthly narrative.

It summarizes what changed in pipeline, what experiments ran, what signals appeared, what customers said, what risks emerged, and what leadership should do next. Every claim links back to source data.

**Composed from**: CRM, warehouse, Slack, call transcripts, campaign state, audit events, narrative skill, approval gates.

## Capability Sources

Trellis should support many capability sources while keeping one contract.

- **Direct APIs** for strategic first-party providers like CRM, email, Slack, warehouse, and research.
- **Managed connector platforms** such as Composio when breadth matters more than bespoke adapter depth.
- **Scripted execution layers** such as Worklayer when one tool call should safely perform a multi-app task and return a compact result.
- **MCP servers** when a tool ecosystem already exists, as long as Trellis maps the raw tool into a named, typed, permissioned Trellis tool.
- **Browser and sandbox automation** when the work needs a real browser, filesystem, code execution, screenshots, PDFs, or long-running tasks.

The rule should stay strict:

> Raw capability in, Trellis contract out.

That means broad tool ecosystems can extend Trellis without weakening Trellis. Users get more reach, but operators still get typed inputs, typed outputs, approval gates, audit logs, retries, and clear ownership.

## Where Models Need Help

Trellis should be honest about model limits and design around them.

- Models do not know what happened today unless Trellis provides current context.
- Models can confuse weak evidence for strong evidence unless skills require citations and confidence.
- Models can produce plausible but invalid structures unless Trellis enforces schemas.
- Models can call the wrong tool unless Trellis scopes tools by workflow.
- Models can over-act unless Trellis blocks risky side effects behind approvals.
- Models can lose the plot across long workflows unless Trellis persists thread state and workflow history.
- Models can get expensive unless Trellis logs usage, routes models intentionally, and keeps prompts grounded.

The product opportunity is not pretending models are perfect. It is giving GTM teams the harness, memory, state, tools, and safety rails that make model work operationally useful.

## What Makes This Trustworthy

Most teams can make an agent demo.

Trellis is for the part after the demo:

- Can we replay what happened?
- Can we see why it qualified someone?
- Can we prove which sources it used?
- Can we stop it from sending without approval?
- Can we resume the same person three days later?
- Can we map outputs into our CRM fields?
- Can we smoke test it after deploy?
- Can we swap providers without rewriting the workflow?
- Can RevOps, sales, marketing, and engineering all inspect the same system?

That is the Trellis wedge: GTM agents that are customizable enough for real teams and structured enough to trust.

## Suggested Public Positioning

**Trellis is the GTM agent stack for teams that want to build their own agents without building the plumbing.**

It gives teams the primitives to turn signals into trusted work: research, qualification, drafts, approvals, replies, handoffs, CRM updates, workflows, and audit trails.

The agent can run wherever the work starts: forms, Slack, email, CRM events, scheduled monitors, CI jobs, queues, or an app. The contract stays the same.

## Public Example

The public v3 example is packaged as a clean, Cloudflare-first GTM SDR example:

```text
examples/gtm-sdr/
  README.md
  docs/demo-form-payload.json
  docs/live-run-result.md
  knowledge/company.md
  knowledge/icp.md
  knowledge/messaging.md
  skills/icp-qualification/SKILL.md
  skills/research-brief/SKILL.md
  skills/sdr-copy/SKILL.md
  skills/reply-policy/SKILL.md
  skills/handoff-policy/SKILL.md
  src/agent.ts
  src/state/prospect.map.ts
```

That example shows one realistic company, one realistic prospect, one form-fill payload, one research-backed qualification, one approval-gated outbound draft, one durable thread, one smoke route, and one clear audit trail.

That gives Trellis the story: a practical GTM agent suite, a concrete SDR proof, and a reliability contract that can expand across the entire revenue motion.
