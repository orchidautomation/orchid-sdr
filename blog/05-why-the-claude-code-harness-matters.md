# Why the Claude Code Harness Matters

A lot of the power in Trellis comes from a simple decision:

do not build a custom agent runtime if you can inherit a better one.

That is why the system uses a Claude-style harness model inside the sandbox.

The important point is not the brand name.

The important point is the interface model.

## What The Harness Gives You

The harness already knows how to work with:

- skills
- MCP servers
- project context
- hooks
- tool calls
- local files

That means Trellis gets a mature agent execution pattern instead of inventing a new one.

This is a bigger advantage than it might sound.

When teams build “agentic products” from scratch, they often end up rebuilding weak versions of:

- tools
- memory
- context loading
- extension systems
- safety boundaries

That is a lot of surface area to get wrong.

## Skills Make Behavior More Durable

One of the most valuable parts of the harness model is skills.

A skill is not a vague system prompt.

It is a durable instruction surface for a repeatable behavior:

- how to qualify against an ICP
- how to structure a research brief
- how to write SDR copy
- when to hand off
- how to reply safely

That lets the system improve by adding or tightening capabilities instead of rewriting entire prompts.

It also makes the agent easier to reason about.

## MCP Makes The System Extensible

MCP is the other major win.

Instead of hardcoding every vendor inside the reasoning loop, the harness can work with:

- first-party MCP tools exposed by the app
- direct vendor MCP servers
- future internal tooling

That creates a very different development model.

Adding a new capability becomes:

1. expose a tool
2. expose a skill
3. teach the agent when to use it

That is much cheaper than building another product subsystem.

## Hooks Are Useful, But Not The Main Runtime

Claude Code hooks are real and useful.

They are great for:

- local automation
- guardrails
- session-specific checks
- enforcing local tool behavior

But they are not the right foundation for business events like CRM sync after send.

Why?

Because business events must happen no matter where the action originated:

- dashboard
- backend workflow
- remote MCP
- local Claude session

That is why hooks are best thought of as developer ergonomics, not the primary business workflow engine.

The correct place for critical operations is still the backend control plane.

## Why This Matters

The harness changes the economics of extensibility.

With the right runtime:

- adding Firecrawl is easy
- adding AgentMail skills is easy
- adding another CRM is easy
- adding another source is easy

That is exactly what you want in a fast-moving category.

The companies that win here will not be the ones that hide their agents inside proprietary magic.

They will be the ones that make their agents easy to extend without making the architecture sloppy.

That is what the Claude-style harness model enables.
