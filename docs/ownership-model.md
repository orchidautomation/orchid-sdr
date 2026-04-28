# Ownership Model

This document defines the intended boundary between Trellis, the reference apps built on top of it, and the coding agents used to customize them.

The main question is:

> If every team composes a different GTM system, what should Trellis generate by default and what should the builder still own?

## Short Answer

Trellis should own the boring infrastructure.

Builders should mostly own:

- app composition
- knowledge
- skills
- policy
- provider choices
- workflow specialization

Cloud Code, Codex, and other coding agents should help customize and extend that surface. They should not be the excuse for missing framework basics.

## The Three Layers

```text
Trellis framework
  -> substrate, contracts, default runtime, state, deploy surfaces

Reference app
  -> one concrete workflow built from that substrate

Builder customization
  -> knowledge, skills, policies, provider choices, custom branches
```

## What Trellis Should Own

These are framework responsibilities and should ship as defaults instead of being rebuilt from scratch for every app.

### 1. State plane defaults

Trellis should provide a default operational state model for GTM agents:

- campaigns
- control flags
- accounts
- people or prospects
- signals
- threads
- contact methods
- research artifacts
- messages
- provider runs
- workflow checkpoints
- agent threads
- audit events
- handoffs

This does not mean every app must use the same exact schema forever.

It means Trellis should ship:

- a default schema
- default repository contracts
- default repository implementation
- extension points for app-specific fields or additional tables

### 2. Runtime defaults

Trellis should provide the default runtime skeleton:

- webhook ingress
- workflow entrypoints
- actor registry
- checkpointing
- retries
- scheduling
- sandbox invocation
- MCP server
- operator dashboard shell

If a builder wants custom actors later, that is fine. But they should start from a working default runtime.

### 3. Provider contracts

Trellis should own:

- capability model
- provider contracts
- capability bindings
- installation planning
- readiness checks
- default module definitions

That is the part that makes the top-layer config possible.

### 4. Deployment surfaces

Trellis should ship:

- doctor and readiness checks
- smoke mode
- deploy helpers
- local boot path
- MCP configuration path
- environment requirements

### 5. Reference workflows

Trellis should provide working starter workflows for common GTM jobs:

- AI SDR
- meeting prep
- account research
- customer success copilot
- pipeline intelligence

Not because those are the only workflows.

Because they make the framework understandable and reusable.

## What The Builder Should Own

These are the parts that should vary by company or deployment.

### 1. Knowledge

- product positioning
- ICP
- compliance rules
- negative signals
- handoff expectations
- customer-specific context

### 2. Skills

- qualification logic
- research standards
- copy style
- reply policy
- routing and handoff judgment

### 3. Provider choices

Examples:

- Attio vs Salesforce
- AgentMail vs another email provider
- Apify vs a first-party source
- Firecrawl vs another search/extract surface

### 4. Campaign and workflow specialization

- sources
- timezones
- sender identities
- quiet hours
- touch rules
- custom approval or review branches

### 5. App-specific extensions

Examples:

- custom tables
- custom webhook sources
- custom actors
- custom MCP tools
- domain-specific workflow steps

## What Coding Agents Should Do

Coding agents should sit on top of Trellis, not replace it.

They are best used for:

- filling in app-specific knowledge
- drafting or editing skills
- adjusting config
- adding providers
- extending schemas safely
- generating app-specific workflow branches

They should not be required to bootstrap the basic substrate every time.

## The Current Truth

Today, the AI SDR example still carries more implementation detail than the ideal end state.

It still includes concrete code for:

- Convex schema
- repository implementation
- actor orchestration
- runtime bootstrap
- dashboard/server surface
- scripts and probes

So the current state is:

> Trellis is composable for technical early adopters, but it is not yet fully turnkey for noobs.

## The Intended End State

The intended end state is:

```text
Trellis generates:
  - state plane
  - runtime skeleton
  - MCP surface
  - deploy path
  - provider modules

Builder edits:
  - config
  - knowledge
  - skills
  - provider choices
  - a few custom branches
```

That is the line between “powerful framework” and “turnkey platform.”
