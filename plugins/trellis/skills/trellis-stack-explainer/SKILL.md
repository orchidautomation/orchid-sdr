---
name: "trellis-stack-explainer"
description: "Explain a Trellis app's active stack, tools, skills, and knowledge to a new user in plain language."
---

# Trellis Stack Explainer

Use this skill when a new user asks what their Trellis app actually contains or what each part does.

## Required Inputs

Read:

1. `ai-sdr.config.ts`
2. `npm run ai-sdr -- modules --json`
3. `npm run ai-sdr -- check --json`

## Output Shape

Explain the app in this order:

1. what the app is trying to do
2. what knowledge it uses
3. what skills it uses
4. what providers are active
5. what each provider does
6. what is optional vs required

## Plain-Language Mapping

Use this language:

- knowledge = context
- skills = behavior
- modules = building blocks
- providers = outside services
- bindings = which outside service does which job

## Noob Rule

Never answer with raw schema language first.

Instead of:

- `capabilityBindings map provider implementations to contracts`

Say:

- `This app uses Attio for CRM sync and Firecrawl for web research`

Then add technical detail only if useful.
