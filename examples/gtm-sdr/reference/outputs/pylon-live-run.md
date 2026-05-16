# Pylon Live Demo Output

Pulled from deployed Trellis state and the live trace cost endpoint on 2026-05-15.

## Run Identity

| Field | Value |
| --- | --- |
| Hosted demo | `$TRELLIS_DEMO_BASE_URL` |
| Database | `trellis-cloud-sdr-db` |
| Agent | `common-room-bdr` |
| Signal | `sig_demo_bdr_pylon_ready_20260515_1512` |
| Trace | `trace_demo_bdr_pylon_ready_20260515_1512` |
| Thread | `lead:pylon:alex-rivera:ready_20260515_1512` |
| Workspace | `wrk_common_room_demo` |
| Source | `website.form` |
| Provider | `trellis.demo` |
| Created | `2026-05-15T15:12:22.221Z` |

## Input Signal

| Field | Value |
| --- | --- |
| Company | `Pylon` |
| Domain | `usepylon.com` |
| Person | `Alex Rivera` |
| Email | `alex.rivera@usepylon.com` |
| Title | `Revenue Operations / GTM Engineering` |
| Consent | `linkedin_opt_in`, `canContact: true` |

Message:

```text
We are looking at Clay-style account research and AI SDR reliability. The issue is knowing which signals are real, routing them correctly, and avoiding unsafe autonomous sending.
```

## State Projection

Trellis projected the run into five business records in `trellis_state_records`:

| Entity | Record |
| --- | --- |
| `accounts` | `usepylon.com` |
| `people` | `alex.rivera@usepylon.com` |
| `prospects` | `prospect_sig_demo_bdr_pylon_ready_20260515_1512` |
| `drafts` | `sig_demo_bdr_pylon_ready_20260515_1512` |
| `signals` | `sig_demo_bdr_pylon_ready_20260515_1512` |

Prospect summary:

```text
Alex Rivera at Pylon is a strong ICP fit: the form-fill explicitly asks about Clay-style account research, AI SDR reliability, knowing which signals are real, routing correctly, and avoiding unsafe autonomous sending. The likely pipeline problems are signal quality, qualification/prioritization, and routing/ownership. Pylon appears to be a B2B SaaS company in AI-native support with account intelligence, omnichannel customer signals, and routing workflows, which maps closely to Common Room's buyer-intelligence and signal-to-action value proposition. Consent is present and contact is allowed.
```

Research summary:

```text
Pylon is an AI-native B2B support platform for ticketing, chat, knowledge base, AI support, and account intelligence. Alex Rivera submitted an opted-in AI SDR diagnostic form from a RevOps / GTM Engineering role and explicitly cares about Clay-style account research, AI SDR reliability, distinguishing real buyer signals, routing them correctly, and avoiding unsafe autonomous sending. Public Pylon pages reinforce that this is a signal-rich, routing-heavy environment: their site describes omnichannel customer conversations across Slack, Teams, email, chat, Discord, and more; AI routing based on intent; account intelligence that turns scattered customer signals into actionable insights; and workflows/playbooks based on customer signals. Common Room should be positioned around turning buyer signals into prioritized GTM action, preserving context, routing ownership, and keeping outbound approval-gated rather than autonomous.
```

## Draft

Status: `blocked_pending_approval`

Required approvals:

- `crm.update`

Draft:

```text
Subject: AI SDR diagnosis

Hi Alex - saw your note about Clay-style account research and AI SDR reliability, especially figuring out which signals are real and how to route them safely.

For Pylon, where customer conversations and account signals span Slack, Teams, email, chat, and account intelligence, the hard part is usually the operating loop: what changed, which account matters, who owns it, and what action is safe.

Common Room helps GTM teams turn buyer signals into prioritized action with richer account/person context and approval-aware workflows. Worth comparing notes on how you're thinking about signal quality before AI SDR execution?
```

Rationale:

```text
Uses the strongest first-party signal from Alex's form-fill and ties it to Pylon's public signal-rich, routing-heavy B2B support context. Positions Common Room around buyer intelligence, prioritization, routing, and safe GTM action without claiming autonomous selling or unsupported private details.
```

## Pending Approvals

| Approval | Action | Status |
| --- | --- | --- |
| `approval_draft_sig_demo_bdr_pylon_ready_20260515_1512_crm_update` | `crm.update` | `pending` |

## Trace Counts

| Event type | Count |
| --- | ---: |
| `runtime.tool_call` | 21 |
| `runtime.tool_start` | 21 |
| `runtime.turn` | 8 |
| `skill.completed` | 3 |
| `skill.started` | 3 |
| `approval.waiting` | 1 |
| `draft.created` | 1 |
| `provider_run.started` | 1 |
| `run.completed` | 1 |
| `signal.accepted` | 1 |
| `workflow.dispatched` | 1 |
| `workflow.running` | 1 |
| `workflow.started` | 1 |
| `workflow.waiting_for_approval` | 1 |

## Timeline Highlights

```text
signal.accepted
provider_run.started
skill.started: icp-qualification
skill.completed: icp-qualification
skill.started: research-brief
skill.completed: research-brief
skill.started: sdr-copy
skill.completed: sdr-copy
workflow.started
draft.created
approval.waiting: crm.update
run.completed
workflow.dispatched
workflow.running
workflow.waiting_for_approval
```

## Cost

| Field | Value |
| --- | ---: |
| Model | `openai/gpt-5.5` |
| Turns | 8 |
| Input tokens | 178,818 |
| Output tokens | 2,704 |
| Cache read tokens | 194,560 |
| Total tokens | 376,082 |
| Estimated cost | `$1.07249` |

By skill:

| Skill | Turns | Cost |
| --- | ---: | ---: |
| `icp-qualification` | 3 | `$0.164214` |
| `research-brief` | 3 | `$0.417344` |
| `sdr-copy` | 2 | `$0.490932` |
