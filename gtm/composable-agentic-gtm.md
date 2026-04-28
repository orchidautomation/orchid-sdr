# Composable Agentic GTM

## Thesis

Trellis should evolve from a strong single AI SDR app into a composable agentic GTM platform.

The core asset is not just outbound automation. The core asset is a reusable GTM execution and intelligence substrate:

1. ingest GTM signals
2. resolve people and companies
3. enrich and research
4. qualify and reason
5. act across email / CRM / handoff
6. persist state and audit trails
7. answer questions and recommend next actions

The AI SDR is the first reference application built on that substrate.

## Product Shape

### Execution loop

- capture signal
- normalize identity
- qualify lead
- build research brief
- draft / send / reply
- sync CRM
- hand off to human

### Intelligence loop

- ingest GTM activity
- normalize content, engagement, people, accounts, opportunities
- attribute outcomes back to touches and content
- compute recommendations
- expose agent-queryable answers through MCP

The second loop is just as important as the first. It is how Trellis becomes real GTM engineering infrastructure rather than only an AI SDR.

## Architecture Direction

### Control plane

- Jungler.ai for webhook ingress
- Rivet ingress actor as the first process layer
- Rivet actors for orchestration, workflow control, retries, scheduling, queues

### Memory / state plane

- Convex as the operational source of truth
- reactive operator surface
- workflow checkpoints
- agent thread state
- normalized events, signals, touchpoints, recommendations

### Data planes

- Convex for live operational state
- Postgres / Neon for current reference-app persistence while migration is in progress
- optional warehouse later for heavy attribution, long-range analytics, and large joins

### Provider model

- strong default opinionated stack
- swappable providers at the capability layer
- first-class MCP support where provider MCPs exist

## Capability Model

Top-level platform capabilities:

- source
- search
- extract
- browser
- enrichment
- crm
- email
- runtime
- state
- model
- handoff
- mcp
- observability
- compliance
- database
- retrieval
- knowledge_sync

Future intelligence-oriented capabilities:

- warehouse
- identity
- attribution
- metrics
- recommendation
- analytics_qa
- private_context

## Naming Decision

Use precise contract-style naming internally and simple labels in the product UX.

### Internal / framework naming

- `research.search.v1`
- `research.extract.v1`
- `research.deepResearch.v1`
- `research.monitor.v1`
- `research.enrich.v1`

### User-facing / CLI / wizard naming

- `search`
- `extract`
- `deep research`
- `monitor`
- `enrichment`

Rule:

- framework contracts should stay explicit and stable
- CLI and onboarding labels should stay short and human-readable
- provider bindings should reflect actual strengths, not vendor marketing claims

## Current Research Binding Decision

Current best-fit mapping:

- `search -> firecrawl`
- `extract -> firecrawl`
- `deep research -> parallel`
- `monitor -> parallel`
- `enrichment -> prospeo`

Important nuance:

- Parallel can technically search and extract, but it is not the preferred default for those jobs
- Firecrawl is the preferred default for open-web search and deterministic extraction
- Parallel is strongest for async task workflows, deep research, and monitoring
- Prospeo remains the current best fit for verified contact-email enrichment in the reference AI SDR

## New Important Categories

Two categories matter a lot for the real happy path:

1. interacting with the live web when APIs and static extraction are not enough
2. retrieving proprietary context from internal tools, docs, apps, and databases

These should become first-class parts of the platform instead of one-off hacks.

### Browser interaction

This is the category for:

- login-required websites
- JavaScript-heavy applications
- stateful sessions
- gated portals
- multi-step workflows
- browser-native extraction and actions

This is different from basic search and extract. Search/extract works for open web content and structured retrieval. Browser interaction is for places where an agent needs a real browser session with cookies, storage, and page actions.

### Proprietary context retrieval

This is the category for:

- internal docs
- CRM records
- support platforms
- billing systems
- data warehouses and operational databases
- shared drives and productivity tools

This is different from static RAG glued together ad hoc. The platform should have a durable way to sync, search, and expose proprietary context to agents through a governed interface.

## Steel.dev

Steel should be thought of as a strong candidate for the `browser` capability.

### Why it fits

- cloud browser sessions built for AI agents
- session-based control model
- support for Playwright, Puppeteer, and Selenium
- browser state, cookies, and storage preserved per session
- anti-bot, proxy, and CAPTCHA handling built into the browser layer
- session observability via live or recorded session viewer
- explicit integrations for agentic browser workflows

### Where Steel fits in the stack

- `browser -> steel`
- possibly `runtime -> steel-browser` for some workflow classes
- browser-backed extraction when Firecrawl or Parallel are not enough
- interactive lead research, portal access, QA, compliance capture, and workflow automation

### Best use cases inside Composable Agentic GTM

- interactive account research on JavaScript-heavy sites
- gated lead enrichment flows
- filling forms or navigating product signup / demo pages for operator workflows
- partner portal and customer portal inspection
- capturing screenshots / PDFs / proofs for handoff or compliance workflows
- browser-native “Claygent replacement” flows where the agent truly needs a browser, not just an API

### Product ideas enabled by Steel

- website-change verification agent
- competitor-monitoring browser agent
- gated-portal account researcher
- conversion QA / signup-flow tester
- compliance evidence collector

### Framework direction for Steel

Eventually this should probably become:

- `@ai-sdr/steel`
- capability ids: `browser`, maybe parts of `extract` and `observability`
- MCP / skill support for browser actions
- explicit workflow guidance for when to escalate from search/extract into live browser control

## Airweave.ai

Airweave should be thought of as a strong candidate for the `retrieval`, `knowledge_sync`, and `private_context` categories.

### Why it fits

- open-source context retrieval layer for apps, databases, and documents
- syncs external tools into searchable collections
- unified search interface instead of one-off source-specific wiring
- supports both REST search and MCP access
- connector model for SaaS apps, docs, and databases
- designed to keep context current through sync rather than static one-time ingestion

### Where Airweave fits in the stack

- `retrieval -> airweave`
- `knowledge_sync -> airweave`
- possibly `mcp -> airweave-search` as an external MCP in the harness
- proprietary-data access for meeting prep, analytics copilot, expansion agent, and account intelligence

### Best use cases inside Composable Agentic GTM

- internal account research across docs, CRM, tickets, and product systems
- customer support + success context for renewal and expansion motions
- pipeline intelligence over synced operational tools
- meeting prep across internal notes, emails, docs, CRM, and support history
- proprietary knowledge grounding for analytics and recommendation agents

### Product ideas enabled by Airweave

- internal GTM copilot
- customer-360 retrieval layer
- CS / renewal prep copilot
- support-informed expansion agent
- private-doc-grounded founder sales copilot

### Framework direction for Airweave

Eventually this should probably become:

- `@ai-sdr/airweave`
- capability ids: `retrieval`, `knowledge_sync`, `private_context`
- collection-aware MCP integration
- governed retrieval patterns so agents query trusted collections instead of raw source chaos

## Happy-Path Architecture For Web + Proprietary Context

The likely happy path is:

1. open-web signal and research layer
   - Firecrawl for search
   - Firecrawl for extraction and crawl
   - Parallel for deep research and monitoring
   - Steel when a real browser session is required

2. proprietary context layer
   - Airweave for synced internal apps, databases, and docs
   - MCP or API access into those collections

3. orchestration + memory layer
   - Jungler for ingress
   - Rivet for workflow and actor orchestration
   - Convex for operational state and reactive UI

That gives:

- public-web context
- private-company context
- real browser execution
- reactive agent state
- explainable operator workflows

## Example Combined Flows

### Meeting prep with both categories

- Airweave pulls CRM, support, notes, and internal docs
- Firecrawl pulls public company and person context
- Parallel runs deeper async research or monitors for relevant change events
- Steel opens any gated customer portal or JavaScript-heavy property when needed
- agent produces a live meeting brief with both internal and external context

### Expansion / CS motion with both categories

- Airweave exposes product, ticketing, and account-history context
- public web research adds hiring, funding, leadership, and narrative changes
- Parallel handles longer-running deep research or change monitoring where that shape is better than direct extraction
- Steel handles gated admin portals or product-surface verification when needed
- agent identifies risk or upsell motion and prepares the human or automated follow-up

### Content intelligence with both categories

- Airweave holds synced CRM and opportunity context
- public web tools capture post and company context
- Parallel can monitor emerging themes or run deeper async research over accounts of interest
- Steel can inspect pages or interactions that basic scraping misses
- attribution agent connects content engagement to real pipeline outcomes

## Configuration Model

The platform should assemble an application from:

1. modules
2. providers
3. capability bindings
4. package boundaries
5. campaign presets

Example mental model:

- `search -> parallel`
- `extract -> firecrawl`
- `enrichment -> prospeo`
- `crm -> attio`
- `email -> agentmail`
- `runtime.actor -> rivet`
- `runtime.sandbox -> vercel-sandbox`
- `state -> convex`

This should ultimately feel like:

- `npx ai-sdr init`
- `npx ai-sdr add crm attio`
- `npx ai-sdr add search parallel`
- `npx ai-sdr add extract firecrawl`

## Open Source Boundary

Public OSS should contain:

- framework schema and composition logic
- provider contracts
- install/add flows
- reference modules
- one reference AI SDR app

Private / hosted leverage can include:

- managed cloud
- hosted control plane
- premium connectors
- advanced observability
- warehouse / attribution packs
- recommendation and analytics copilots
- enterprise security / policy layers

## Product Presets Beyond AI SDR

- inbound qualification router
- signal-to-pipeline engine
- meeting prep / rep copilot
- expansion / upsell agent
- event follow-up operator
- partner/channel prospecting operator
- GTM analytics copilot
- content-to-pipeline intelligence

## Expanded Preset Catalog

### Execution products

- AI SDR
- inbound qualification router
- signal-to-pipeline engine
- ABM operator
- founder-led sales operator
- event follow-up operator
- partner / channel prospecting operator
- expansion / upsell agent
- renewal / churn rescue agent
- PLG conversion agent

### Intelligence products

- content-to-pipeline intelligence
- LinkedIn post ICP attribution
- GTM analytics copilot
- pipeline attribution engine
- meeting prep / rep copilot
- account research copilot
- territory / TAM builder
- CRM hygiene and enrichment ops
- next-best-action recommendation engine

### Control-plane / ops products

- workflow debugger
- provider observability console
- cost-control / automation governor
- compliance and approval layer
- sandbox / tool audit surface
- human handoff router
- send-policy simulator

## Product Notes By Preset

### Inbound qualification router

- ingest form fills, demo requests, chat-to-lead, and inbound email
- qualify against ICP and route to the right rep or sequence
- enrich and research before human follow-up
- update CRM and handoff channels automatically

### Signal-to-pipeline engine

- watch hiring, funding, job changes, website changes, launches, and content signals
- decide which signals deserve account or prospect creation
- create account / contact / opportunity scaffolding automatically
- route the outcome into outbound, founder sales, or human review

### ABM operator

- orchestrate named-account plays
- coordinate multiple contacts at one account
- build account plans from public and internal context
- recommend sequence of touchpoints instead of single-thread outreach

### Founder-led sales operator

- prioritize warm leads, intros, and strategic targets
- draft founder-style notes
- prep calls and follow-ups
- keep CRM and thread state updated without manual RevOps work

### Event follow-up operator

- ingest booth scans, webinar registrants, attendee exports, and calendar meetings
- enrich and rank follow-up priority
- route to rep, sequence, or nurture
- attach event provenance to CRM and attribution records

### Partner / channel prospecting operator

- identify agencies, SIs, consultants, and channel partners
- qualify partner fit by overlap, customer base, vertical, and motion
- support co-selling and referral workflows instead of direct outbound

### GTM analytics copilot

- answer questions over normalized GTM state
- explain what is happening, not just return raw numbers
- summarize pipeline health, campaign effectiveness, and source quality
- recommend next actions based on observed outcomes

### Content-to-pipeline intelligence

- connect content production to ICP engagement and pipeline creation
- identify which themes, formats, and narratives create qualified demand
- feed those learnings back into outbound and content strategy

## Expansion / CS Agent

This is one of the strongest non-net-new presets because it uses the same primitives but points them at existing customers instead of prospects.

### Core jobs

- monitor account health and expansion signals
- detect risk and opportunity
- recommend outreach, handoff, renewal, or save motions
- sync the resulting state back into CRM and CS systems

### Signal sources

- product usage
- seat growth
- inactive seats
- feature adoption
- support tickets
- support sentiment
- champion job changes
- billing events
- roadmap requests
- NPS / CSAT responses
- QBR notes
- Slack / email threads with customers

### Example workflows

#### 1. Seat expansion trigger

- product usage spikes in one department
- multiple new teammates invited within 14 days
- account has no active opportunity
- agent opens an expansion thread
- drafts a note for the CSM or AE with evidence and suggested pitch angle
- creates CRM task / expansion opportunity suggestion

#### 2. Champion departure risk

- LinkedIn or internal CRM data shows the main champion changed companies
- account usage is stable but executive sponsor is weak
- agent flags the account as at-risk
- proposes a re-mapping plan for new stakeholders
- drafts internal handoff notes and external re-engagement suggestions

#### 3. Feature maturity upgrade

- customer adopts the basic version of a workflow heavily
- adjacent premium feature usage indicators are present
- agent identifies likely upsell fit
- composes a maturity narrative: what they do today, what breaks next, what premium tier solves
- routes suggestion to AE/CSM with supporting evidence

#### 4. Renewal rescue

- usage declines over 30 days
- support dissatisfaction rises
- billing renewal date is approaching
- agent assembles a risk brief
- recommends executive outreach, training intervention, or save package
- keeps a live checklist of recovery actions and outcomes

### Example user questions this product should answer

- Which accounts show the strongest expansion intent this week?
- Which renewals are most at risk and why?
- Which customers have product behavior that suggests enterprise upsell fit?
- Which champion departures need immediate stakeholder re-mapping?
- Which accounts are growing usage but not commercial footprint?

### Example outputs

- expansion-ready account brief
- renewal-risk brief
- champion-loss alert
- next-best-action recommendation for CSM / AE
- auto-generated CRM task, note, or opportunity suggestion

## Meeting Prep / Rep Copilot

This is likely one of the easiest products to sell because it does not require full autonomy to be useful. It helps humans perform better in the moments that matter.

### Core jobs

- assemble live account and contact context before meetings
- summarize recent signals and business context
- identify risks, opportunities, and likely objections
- recommend agenda, discovery questions, and follow-up actions

### Inputs

- CRM account, contact, and opportunity data
- recent emails and replies
- meeting title / attendees / calendar metadata
- product usage and support context
- public company research
- recent content or signal activity
- internal notes from past meetings

### Example workflows

#### 1. Demo prep

- AE has a demo tomorrow with two attendees
- copilot resolves both attendees, company context, recent signals, and CRM history
- summarizes likely priorities, technical maturity, stakeholder roles, and objection vectors
- generates a call brief with recommended agenda and discovery questions

#### 2. Executive renewal prep

- CSM has a renewal check-in with an executive sponsor
- copilot compiles usage trend, support history, renewal risk factors, open asks, and commercial context
- proposes what to emphasize, what not to overstate, and where to ask for expansion support

#### 3. Multi-threaded enterprise deal prep

- several stakeholders are on the meeting invite
- copilot maps likely personas and influence roles
- highlights internal misalignment risk
- suggests which proof points matter to which attendee
- flags open questions that must be resolved to move the deal forward

#### 4. Follow-up drafting

- after the meeting, copilot turns transcript or notes into
  - recap email
  - CRM note
  - next steps list
  - identified blockers
  - handoff requests if specialists are needed

### Example user questions this product should answer

- Who is on this call and what probably matters to each person?
- What changed at this account since our last meeting?
- What signals suggest real urgency versus polite interest?
- What are the most likely objections I should handle?
- What should the next step be if the meeting goes well?

### Example outputs

- one-page meeting brief
- stakeholder map
- likely objection list
- recommended discovery questions
- post-meeting follow-up draft
- CRM-ready recap note

## Priority Candidates

If the roadmap needs to stay tight, the strongest next presets after the current AI SDR are:

1. inbound qualification router
2. signal-to-pipeline engine
3. content-to-pipeline intelligence
4. meeting prep / rep copilot
5. expansion / CS agent

## LinkedIn + SFDC Intelligence Product

The LinkedIn / SFDC attribution system is not a side project. It is a second flagship preset.

Desired outcome:

- ingest post activity and engagement
- resolve person / company / account / opportunity
- join content to pipeline outcomes
- qualify ICP quality of engagement
- answer questions through MCP
- recommend what to publish next

Key rule: do not let the agent reason over raw tables blindly. Give it governed tools, trusted joins, and explicit metrics.

## Operator Expectations

- `Pause Automation` lets in-flight work finish
- no new discovery, probe, qualification, research, or send work should start while paused
- `No sends mode` remains a separate safety rail
- dashboard should degrade gracefully when runtime providers are slow
- runtime diagnostics should never blank core GTM state

## Near-Term Build Plan

1. formalize capability schema and bindings
2. normalize provider contracts around the highest-value runtime paths
3. finish moving state-plane writes and reads toward Convex
4. define package boundaries for the OSS framework
5. make the reference AI SDR instantiate from config rather than implicit adapter wiring

## Commercial Direction

Possible business shapes:

- OSS framework + hosted cloud
- implementation services + managed runtime
- premium connectors / analytics / attribution
- agentic GTM operating system for GTM engineers

The strongest framing is:

- **Composable Agentic GTM** = platform
- **Trellis** = first reference app / preset

## Naming Options

The product likely needs two names:

1. the platform / category product
2. the install surface / package family

### Best Product Name Directions

#### 1. Trellis GTM

Best if the company brand should stay primary.

- simple
- credible
- broad enough for SDR, inbound, analytics, and CS presets
- easy to extend with sub-products

Examples:

- Trellis GTM
- Trellis Agentic GTM
- Trellis GTM OS

#### 2. Trellis Flow

Best if the product should feel like an orchestration layer.

- emphasizes workflow
- fits Rivet / Convex / composability well
- weaker if the goal is explicit GTM category ownership

#### 3. Trellis Signal

Best if the platform centers around event-driven GTM automation.

- good for signal-to-pipeline framing
- a bit narrower than the full platform story

#### 4. Composable Agentic GTM

Best as the category / manifesto label.

- very accurate
- strong internal framing
- too descriptive and long to be the primary product name

Use this as the category statement more than the brand name.

### Best Package Naming Directions

#### 1. `ai-sdr`

Best near-term install surface.

- authoritative
- simple
- matches the current reference app
- easy onboarding:
  - `npx ai-sdr init`
  - `npx ai-sdr add firecrawl`
  - `npx ai-sdr add attio`

Weakness:

- undersells the long-term GTM platform if the framework expands beyond SDR

#### 2. `gtm-agent`

Stronger if the install surface should imply broader GTM scope.

- still simple
- broader than SDR
- less ownable than `ai-sdr`

#### 3. `agentic-gtm`

Best for accuracy, weaker for polish.

- says exactly what it is
- feels more technical than productized

#### 4. `orchid`

Best only if the OSS package should fully inherit the company brand.

- short
- strong if available everywhere
- too broad if the package does not clearly signal GTM purpose

### Recommended Split

Current best split:

- **Product:** Trellis GTM
- **Category statement:** Composable Agentic GTM
- **Reference app:** Trellis
- **Package / CLI:** `ai-sdr`

That gives the cleanest ladder:

- company / product brand stays Trellis
- the framework vision stays broad
- the install surface stays simple and obvious
