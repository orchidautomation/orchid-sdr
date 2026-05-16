# CS Churn Agent Overview

This file is the Trellis version of the original `CLAUDE.md` project pointer. It is mounted as regular agent knowledge so Claude Code, Codex, MCP clients, Slack, Notion, and the deployed runtime all share the same context.

The agent assesses churn risk for a customer account by combining three evidence sources:

- Salesforce account, contract, renewal, sponsor, QBR, and CSM health signals
- Zendesk support volume, escalation, theme, SLA, and CSAT signals
- Product usage signals: registration, utilization, member activity, admin cadence, and modality mix

The runtime graph lives in `src/agent.ts`, not in prose:

1. Load the normalized signal and account identity.
2. Run `churn-salesforce`, `churn-zendesk`, and `churn-usage` in parallel.
3. Run `churn-risk-score` over those three outputs.
4. Run `churn-playbook` over the score.
5. Start a durable `churn-assessment` workflow that persists state, records the run timeline, and blocks CRM updates behind approval.

Skills may reference the outputs of earlier skills, but they should not secretly invoke other skills. Trellis owns orchestration in code so runs are observable, testable, and auditable.

## Safety Rules

- Default to read-only access for Salesforce, Zendesk, and usage data.
- Never quote raw support ticket bodies in the final brief.
- Mask personal phone numbers, private emails, PHI, salary, compensation, and sensitive clinical content.
- Treat missing data as `Not available`; do not infer false from unknown.
- CRM updates require `crm.update` approval before execution.
- If any evidence source fails, continue with available sources and lower confidence.

## Output Contract

The final run should produce a single churn risk brief with:

- headline risk band and score
- top weighted drivers
- mitigants
- confidence
- highest leverage save action
- action plan with owner, persona, timeframe, and definition of done
- evidence appendix for Salesforce, Zendesk, and usage
