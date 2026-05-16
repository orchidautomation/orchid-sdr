# Trellis CS Churn Example

This example turns Snithika's Claude churn workflow into a Trellis-native customer success agent.

The important design change is that host-specific files are not the runtime brain. The original `CLAUDE.md` project pointer is now `knowledge/agent-overview.md`, and the `/churn-check` command is now explicit orchestration in `src/agent.ts`.

## What It Shows

```text
customer account signal
  -> Trellis CS churn agent
  -> parallel evidence skills
     -> churn-salesforce
     -> churn-zendesk
     -> churn-usage
  -> churn-risk-score
  -> churn-playbook
  -> approval-gated crm.update
  -> traceable account health state
```

The skills can depend on earlier skill outputs, but `src/agent.ts` owns the graph. That gives Trellis trace events with parent/phase metadata instead of hiding orchestration inside markdown.

## Layout

```text
src/                  runtime code
  agent.ts            explicit skill graph and approval gate
  integrations/       Salesforce, Zendesk, and usage data maps
  mcp/                CS-focused MCP surface
  state/              account-health state map
knowledge/            mounted agent context
skills/               reusable skill instructions
reference/            demo inputs and walkthrough notes
```

## Files To Walk Through

1. `knowledge/agent-overview.md`
   Shows how `CLAUDE.md` maps into Trellis as normal knowledge.

2. `src/agent.ts`
   Shows the actual skill graph: three gather skills in parallel, then risk scoring, then playbook creation, then approval-gated CRM update.

3. `skills/churn-risk-score/SKILL.md`
   Shows the rule that scoring only reasons over prior skill outputs. It does not fetch data.

4. `knowledge/integration-access.md`
   Documents the preferred access paths for Salesforce, Zendesk, and usage data.

5. `src/integrations/*.map.ts`
   Shows where a real team maps its CRM fields, Zendesk search patterns, and warehouse metrics.

6. `src/integrations/composio.toolkit.map.ts`
   Shows how Composio toolkits/MCP can be modeled as a managed access layer without changing Trellis skills.

7. `reference/integration-substitution-guide.md`
   Shows exactly how placeholder tool calls become real Salesforce, Zendesk, Composio, Snowflake, Postgres, or direct API calls.

## Run Locally

```bash
npm install
npm run typecheck
npm run smoke:cs
npm run trellis -- doctor
npm run trellis -- smoke
```

## Demo Signal

Use `reference/inputs/churn-signal.json` as the demo payload shape. In a deployed environment it posts to:

```bash
curl -sS "$TRELLIS_CS_CHURN_URL/webhooks/signals" \
  -H "content-type: application/json" \
  -H "x-trellis-api-key: $TRELLIS_API_KEY" \
  --data @reference/inputs/churn-signal.json
```

## Integration Stance

- Salesforce: prefer Salesforce Hosted MCP Servers or a first-party OAuth-backed Salesforce API adapter.
- Zendesk: prefer official Zendesk Ticketing API until a reviewed MCP bridge is approved.
- Usage data: prefer Snowflake managed MCP when on Snowflake, or a read-only Postgres/reference MCP against a sanitized replica.
- Composio: credible managed-toolkit option for faster SaaS coverage, but it must map back into Trellis provider capabilities and preserve approval gates.

Trellis remains the runtime of record for orchestration, traces, approvals, provider actions, state, and safety.

## Resource Bindings

`wrangler.jsonc` declares the runtime resources this example expects: durable agent identity, D1 state, pack/artifact storage, events queue, workflow, AI binding, browser binding, and a scheduled repair trigger. The D1 `database_id` is a placeholder; replace it after provisioning the demo database.
