# NPM Publish Plan

## Purpose

This document is the repo-specific npm release plan for Trellis.

It is not a generic npm tutorial. It focuses on what is true in this repo today, what is missing, and what has to change to publish a clean public `npx` experience.

---

## Executive Summary

The clean public launch shape is:

1. `create-ai-sdr`
   - primary `npx` entry point
   - scaffolds a Trellis app

2. `@ai-sdr/framework`
   - public library package
   - framework primitives, composition, contracts, validation

3. optional public provider packages later
   - `@ai-sdr/apify-linkedin`
   - `@ai-sdr/firecrawl`
   - `@ai-sdr/prospeo`
   - `@ai-sdr/convex`
   - `@ai-sdr/rivet`
   - `@ai-sdr/agentmail`
   - `@ai-sdr/attio`
   - `@ai-sdr/slack`

### Recommended first release

Do **not** try to make every workspace package production-grade on day one.

The simplest first public launch is:

1. publish `create-ai-sdr`
2. optionally publish `@ai-sdr/framework`
3. keep the rest repo-internal until the public package boundaries are cleaner

---

## Current Repo Truth

### Root package

Current root `package.json`:

- name: `trellis`
- version: `0.1.0`
- `private: true`
- workspaces enabled

### Workspace packages

Current workspace packages are also private.

Examples:

- `@ai-sdr/cli`
- `@ai-sdr/framework`
- `@ai-sdr/apify-linkedin`
- `@ai-sdr/firecrawl`
- `@ai-sdr/prospeo`
- etc.

### Current CLI publish blocker

The CLI package currently uses:

```json
"bin": {
  "ai-sdr": "./src/cli.ts"
}
```

That is fine inside the monorepo with `tsx`, but it is **not** a clean public npm distribution story.

### Current release workflow blocker

There is currently **no `.github/` directory in this repo**.

That means:

- no publish workflow here yet
- no release workflow here yet
- no repo-local CI/CD wiring for npm in this repo yet

If you already have that pattern elsewhere, good. This repo still needs its own version of it.

---

## Recommended Package Strategy

## Option A: recommended

### Public package 1: `create-ai-sdr`

Purpose:

- one-shot scaffold command
- best UX for strangers from LinkedIn / GitHub

Command:

```bash
npx create-ai-sdr@latest
```

This package should:

- contain the built scaffold CLI
- include scaffold template assets
- generate a full Trellis repo

### Public package 2: `@ai-sdr/framework`

Purpose:

- reusable composition primitives
- module registry
- contracts
- validation
- install planning

This is useful for technical users and for ecosystem credibility.

## Option B: secondary

### Public package: `@ai-sdr/cli`

Command:

```bash
npx @ai-sdr/cli@latest init
```

This is technically workable but worse as a first-touch experience than `create-ai-sdr`.

### Recommendation

Use `create-ai-sdr` as the public front door even if the implementation internally reuses `@ai-sdr/cli`.

---

## What The Create Package Must Actually Do

The create package is not just a small argument parser.

It must ship:

1. the compiled CLI
2. the scaffold templates it copies into the new repo
3. the framework metadata it uses to compute profiles and module composition

### Today the scaffold copies these kinds of assets

- `docs/`
- `knowledge/`
- `packages/`
- `scripts/`
- `skills/`
- `src/`
- `tests/`
- `Dockerfile`
- `vercel.json`
- `tsconfig.json`
- `.gitignore`
- `.dockerignore`

That means the published package must include those assets or another equivalent template source.

---

## Current Technical Gaps Before Publish

## 1. The CLI must be built to JavaScript

Today the CLI entry is TypeScript source.

Before publish:

- add a proper build step for the CLI package
- emit `dist/cli.js`
- point `bin` to built output
- include a shebang

Example target:

```json
"bin": {
  "create-ai-sdr": "./dist/cli.js"
}
```

or, if you keep `@ai-sdr/cli`:

```json
"bin": {
  "ai-sdr": "./dist/cli.js"
}
```

## 2. Decide what to publish vs bundle

You need to decide whether `create-ai-sdr`:

- bundles its internal dependencies
- or depends on separately published workspace packages

### Recommendation

For the first release, keep it simple:

- build the create package
- bundle or package the scaffold logic with it
- do not force a day-one multi-package public release if it does not add user value

## 3. Stop depending on monorepo-only assumptions

The published package cannot assume:

- local workspace resolution
- `tsx` is present
- source-only bin execution
- unpublished sibling packages

## 4. Decide which packages stay private

This repo currently exposes package boundaries conceptually, but not every boundary must be public on day one.

The likely day-one public set is:

- `create-ai-sdr`
- `@ai-sdr/framework`

Everything else can remain internal until:

- exports are stable
- package docs are clean
- versioning discipline is ready

## 5. Add repo-local release automation

Because this repo has no `.github/` directory yet, it still needs:

- CI for typecheck and tests
- release workflow
- npm publish workflow
- versioning policy

---

## Recommended Release Sequence

## Phase 1: Make the public create command real

Goal:

```bash
npx create-ai-sdr@latest
```

works for a new user with no repo clone.

### Work

1. create a publishable package
2. build the CLI to `dist`
3. include scaffold assets in the npm tarball
4. verify the generated project boots
5. document the exact command in the root README

## Phase 2: Make `@ai-sdr/framework` public

Goal:

- external users can depend on the framework primitives directly

### Work

1. make `packages/framework/package.json` public
2. verify exports
3. add build or publish strategy
4. test a clean install in a throwaway repo

## Phase 3: Decide which provider packages deserve public treatment

Goal:

- only publish packages that are truly worth supporting as public API

Examples:

- `@ai-sdr/apify-linkedin`
- `@ai-sdr/firecrawl`
- `@ai-sdr/prospeo`

Do not publish them just because the monorepo has them.

---

## What The NPM User Journey Should Feel Like

The user should be able to do this:

```bash
npx create-ai-sdr@latest
cd my-sdr
npm install
cp .env.example .env
npm run doctor
npm run dev
```

Then either:

1. boot in smoke mode and see the dashboard
2. or wire real providers and run one real signal

If the package does not reliably deliver that journey, it is not ready to publish.

---

## The Publish Readiness Checklist

## Product readiness

- [ ] public package name chosen
- [ ] first-run README updated
- [ ] GitHub repo landing page points to the `npx` command
- [ ] day-zero user journey is documented

## Package readiness

- [ ] package is not `private`
- [ ] `bin` points to built JS, not TS source
- [ ] package includes required scaffold assets
- [ ] package installs correctly from npm tarball
- [ ] `npm pack` dry run looks clean

## Technical readiness

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] scaffold command works from a packed tarball
- [ ] generated project runs `npm install`
- [ ] generated project passes `npm run doctor`
- [ ] generated project boots in smoke mode

## Docs readiness

- [ ] root README uses the public command
- [ ] scaffolded README is accurate
- [ ] `TRELLIS_SETUP.md` is accurate
- [ ] MCP docs are accurate

## Release readiness

- [ ] npm token is configured in CI
- [ ] release workflow exists in this repo
- [ ] version bump strategy is chosen
- [ ] tag/release process is documented

---

## Recommended Day-Before-Publish Dry Run

Use this sequence before the real release.

## 1. Pack the candidate package locally

```bash
npm pack
```

## 2. Run it exactly like a stranger would

Example shape:

```bash
npx ./create-ai-sdr-0.1.0.tgz
```

or if the package name differs, the equivalent tarball entry point.

## 3. Generate a fresh project

Verify:

- scaffold command runs
- files are generated
- `README.md` is accurate
- `TRELLIS_SETUP.md` is accurate

## 4. Install the generated project

```bash
cd <generated-project>
npm install
```

## 5. Prove the first-run path

Smoke path:

```bash
export TRELLIS_LOCAL_SMOKE_MODE=true
export TRELLIS_SANDBOX_TOKEN=local-sandbox-token
export HANDOFF_WEBHOOK_SECRET=local-handoff-secret
export DASHBOARD_PASSWORD=dev
export DISCOVERY_LINKEDIN_ENABLED=false

npm run doctor
npm run dev
```

Verify:

- `/healthz`
- `/dashboard`
- dashboard login

If this is not smooth, do not publish yet.

---

## Cloud Code And Release Support

Cloud Code or another coding agent can help with:

1. turning the CLI into a compiled publishable package
2. adding `files` whitelists
3. adjusting `bin`
4. validating tarball contents
5. generating release docs
6. updating README copy
7. creating CI workflow files
8. running dry runs

What it cannot do alone:

1. create npm org governance decisions
2. choose your final public package naming without product input
3. mint tokens or authenticate vendor dashboards on your behalf

---

## Recommended Publish Decision

For the immediate next step, the highest-leverage path is:

1. publish `create-ai-sdr`
2. keep the UX focused on scaffolding one working Trellis app
3. delay broad public package surface area until the create flow is smooth

That gets the public story aligned with the actual product story:

> Find Trellis, run one `npx` command, get your own composable AI SDR.

That is the release worth shipping first.
