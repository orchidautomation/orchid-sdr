# Current Live Demo Result

Last reset and seed: 2026-05-15.

Live Worker:

```text
https://trellis-cloud-sdr.brandon-ccf.workers.dev
```

Current curated demo run:

```text
agent: common-room-bdr
mcp server: trellis-sdr
signal: sig_demo_bdr_pylon_ready_20260515_1512
trace: trace_demo_bdr_pylon_ready_20260515_1512
thread: lead:pylon:alex-rivera:ready_20260515_1512
workspace: wrk_common_room_demo
company: Pylon
status: qualified
workflow: prospect
workflow dispatch: succeeded
draft status: blocked_pending_approval
```

## Database Shape

After cleanup and seed, deployed D1 contains only the curated demo run:

| Table | Rows |
| --- | ---: |
| `trellis_signals` | 1 |
| `trellis_prospects` | 1 |
| `trellis_drafts` | 1 |
| `trellis_approvals` | 2 |
| `trellis_provider_actions` | 0 |
| `trellis_provider_runs` | 1 |
| `trellis_workflow_runs` | 1 |
| `trellis_audit_events` | 9 |
| `trellis_trace_events` | 66 |
| `trellis_state_records` | 5 |
| `trellis_agent_sessions` | 1 |
| `trellis_smoke_runs` | 0 |
| `trellis_operator_controls` | 0 |
| `trellis_slack_threads` | 0 |

## Pending Approvals

The demo intentionally leaves side effects pending:

| Approval | Provider | Status |
| --- | --- | --- |
| `approval_draft_sig_demo_bdr_pylon_ready_20260515_1512_email_send` | email | pending |
| `approval_draft_sig_demo_bdr_pylon_ready_20260515_1512_crm_update` | attio | pending |

This is the right live state for a demo: the agent has done the work, but a human still owns external side effects.

## Draft Created

Subject: AI SDR diagnosis

Hi Alex - saw your note about Clay-style account research and AI SDR reliability, especially figuring out which signals are real and how to route them safely.

For Pylon, where customer conversations and account signals span Slack, Teams, email, chat, and account intelligence, the hard part is usually the operating loop: what changed, which account matters, who owns it, and what action is safe.

Common Room helps GTM teams turn buyer signals into prioritized action with richer account/person context and approval-aware workflows. Worth comparing notes on how you're thinking about signal quality before AI SDR execution?

## Trace Summary

The live trace has 66 events:

| Event type | Count |
| --- | ---: |
| `signal.accepted` | 1 |
| `provider_run.started` | 1 |
| `skill.started` | 3 |
| `flue.tool_start` | 21 |
| `flue.tool_call` | 21 |
| `flue.turn` | 8 |
| `skill.completed` | 3 |
| `workflow.started` | 1 |
| `draft.created` | 1 |
| `approval.waiting` | 2 |
| `run.completed` | 1 |
| `workflow.dispatched` | 1 |
| `workflow.running` | 1 |
| `workflow.waiting_for_approval` | 1 |

## Cost Summary

Estimated model cost from `estimate_cost` / `GET /traces/:traceId/cost`:

```text
model: openai/gpt-5.5
turns: 8
input tokens: 178,818
output tokens: 2,704
cache read tokens: 194,560
total tokens: 376,082
estimated cost: $1.07249
```

By skill:

| Skill | Turns | Estimated cost |
| --- | ---: | ---: |
| `icp-qualification` | 3 | `$0.164214` |
| `research-brief` | 3 | `$0.417344` |
| `sdr-copy` | 2 | `$0.490932` |

## What To Ask In Claude Code

```text
Use trellis-sdr to describe this BDR agent.
```

```text
Use trellis-sdr to show current leads and pending approvals.
```

```text
Use trellis-sdr to get the Pylon lead for trace_demo_bdr_pylon_ready_20260515_1512.
```

```text
Use trellis-sdr to estimate the model cost for trace_demo_bdr_pylon_ready_20260515_1512.
```

```text
Use trellis-sdr to explain what a human can approve next and what remains blocked by no-send mode.
```
