# CS Churn Reference

This folder contains demo inputs and walkthrough material for the CS churn example.

- `inputs/churn-signal.json` is the account-health signal sent into Trellis.
- `integration-substitution-guide.md` shows how placeholders map to Salesforce Hosted MCP, Composio toolkits/MCP, Zendesk API, Snowflake MCP, Postgres MCP, or direct adapters.

The demo should focus on the shape of the agent, not a live write into a production CS stack:

1. Show the signal payload.
2. Show `src/agent.ts` and the explicit sub-skill graph.
3. Show `knowledge/agent-overview.md` as the Trellis replacement for `CLAUDE.md`.
4. Show `knowledge/integration-access.md` for reputable integration paths.
5. Run the signal, then inspect the run timeline for `skill.started` and `skill.completed` events under `churn-assessment`.
6. Approve or reject the queued `crm.update` proposal.
