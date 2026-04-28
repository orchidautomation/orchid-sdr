# Turnkey Roadmap

This document describes the concrete work needed to make the Trellis AI SDR scaffold more turnkey and less custom-code heavy.

The goal is not to hide the system.

The goal is to move repeated infrastructure down into the framework so builders can stay closer to:

- config
- knowledge
- skills
- provider choices
- workflow specialization

## Current Problem

The reference AI SDR is already strongly composed at the top level, but it still contains too much concrete implementation detail in the app itself.

Today a builder inherits:

- Convex schema files
- repository implementations
- actor and orchestration code
- server and dashboard plumbing
- multiple operational scripts
- probes and migration surfaces

That is acceptable for an early technical adopter.

It is too much for the “install, understand, adapt, ship” path we want.

## Principle

Move repeated infrastructure down into Trellis.

Leave app-level code for:

- app composition
- knowledge
- skills
- policy
- custom workflow steps

## Phase 1: Make The Default Substrate Canonical

### 1. Canonical state-plane package

Extract the default state model from the AI SDR example into a framework-owned default.

Scope:

- Convex schema
- default repository contracts
- default repository implementation
- default workflow checkpoint shape
- default audit and provider-run tracking

Deliverable:

- one Trellis-owned default state substrate
- extension points for app-specific fields and tables

### 2. Canonical runtime skeleton

Extract the repeated runtime pieces into the framework.

Scope:

- actor registry skeleton
- default webhook entrypoints
- workflow bootstrap
- sandbox broker skeleton
- MCP server bootstrap
- dashboard bootstrap

Deliverable:

- generated runtime that works before any app-specific edits

### 3. Canonical deploy and readiness path

Make the local and hosted boot story feel deterministic.

Scope:

- doctor/readiness
- smoke mode
- deploy helpers
- MCP setup helpers
- environment requirement generation

Deliverable:

- one clear happy path for local proof
- one clear happy path for hosted deployment

## Phase 2: Shrink The App Layer

### 4. Reduce AI SDR-specific custom code

Audit the current AI SDR example and move the repeatable parts into Trellis-owned packages.

Main candidates:

- `src/repository.ts`
- `src/repository-convex.ts`
- `src/repository-local-smoke.ts`
- parts of `src/orchestration/*`
- parts of `src/services/runtime-*`
- parts of `src/server.ts`
- parts of `convex/*`

Deliverable:

- thinner example app
- more obvious extension surface

### 5. Treat the app manifest as the center of gravity

Continue pushing app composition into `ai-sdr.config.ts`-style manifest code.

Target app-owned surface:

- knowledge references
- skill references
- provider bindings
- campaign defaults
- webhooks
- model routing
- optional modules

Deliverable:

- app mostly expressed as a blueprint

## Phase 3: Multiple First-Class Recipes

### 6. Ship more than AI SDR

The framework will feel less “custom” when there are multiple concrete recipes built from the same substrate.

Priority candidates:

- AI SDR
- meeting prep
- account research
- customer success copilot
- pipeline intelligence

Deliverable:

- users understand what is framework vs what is recipe

## Phase 4: Better Builder UX

### 7. Strengthen the plugin-led onboarding flow

The Trellis plugin should become the default guided experience.

It should help a noob:

- scaffold the app
- understand the stack
- check readiness
- connect providers
- connect MCP
- deploy

Deliverable:

- less CLI memorization
- fewer setup mistakes
- clearer next steps

### 8. Add stronger anatomy docs

Every example app should have:

- what it is
- how it runs
- what Trellis owns
- what the builder owns
- which files matter first

Deliverable:

- lower cognitive load for first-time builders

## AI SDR Extraction Targets

The current AI SDR example is the first place to reduce custom work.

### Best near-term extraction targets

1. state plane
2. repository contracts and default implementation
3. runtime bootstrap
4. actor bootstrap
5. webhook bootstrap
6. MCP bootstrap
7. dashboard shell

### Likely app-specific for longer

1. qualification heuristics
2. research brief shape
3. copywriting behavior
4. reply and handoff policy
5. campaign definitions
6. custom provider mixtures

## What Success Looks Like

Success is not “no code.”

Success is:

```text
Trellis owns the substrate.
The builder owns the composition.
Coding agents customize the edges.
```

In practical terms, a noob should be able to:

1. install the plugin
2. scaffold a Trellis app
3. boot it in smoke mode
4. connect one or two providers
5. understand the app shape
6. ship a first deployment

without first having to understand every schema, repository, actor, and script in the reference app.
