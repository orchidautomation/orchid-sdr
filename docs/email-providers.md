# Email Providers for Trellis

This page is about one narrow question:

Which email provider is the best fit for Trellis?

Short answer:

- `AgentMail` is the best default fit for Trellis's current architecture.

That is not the same as saying it is universally the best email provider. It means it is the best match for the way Trellis already works:

- campaign-scoped sender identities
- inbox provisioning
- inbound webhook wake-ups
- thread continuity
- agent-owned mailboxes instead of human-owned mailboxes

## Recommendation

If you want Trellis to run as an agent-native outbound system, use:

1. `AgentMail`
2. `MailSlurp`
3. `EmailEngine`

If you want a simpler send-plus-receive setup and do not need inbox infrastructure, use:

1. `Resend`
2. `Postmark`

If you want the agent to act inside a real user's mailbox, use:

1. `EmailEngine`
2. `Nylas`

## Why AgentMail Fits Best

AgentMail maps most closely to Trellis's mental model.

What Trellis wants from email:

- create or pin a sender identity per campaign
- keep one inbox identity per thread
- send first outbound and later replies from the same source
- receive inbound replies through a webhook
- preserve thread continuity
- optionally scale to many inboxes and domains

AgentMail is built around those ideas:

- inbox creation and management
- message send and reply
- threaded conversations
- real-time events
- custom domains
- guidance for warm-up and multi-inbox volume distribution

That makes it a strong fit for agent-native SDR workflows rather than just generic application email.

## Comparison Matrix

| Provider | Best for | Fit for Trellis | Why |
|---|---|---|---|
| `AgentMail` | Agent-owned inboxes and replies | Best fit | Inbox primitives, replies, threads, webhooks, custom domains, and warm-up guidance align with the current workflow model |
| `MailSlurp` | Programmable inbox infrastructure | Good fit | Real inbox objects, send and receive, webhooks, custom domains, plus-addressing |
| `EmailEngine` | Self-hosted or BYO mailbox control plane | Good fit | Unified API over Gmail, Outlook, and IMAP with strong webhook support |
| `Resend` | Product email, light receive and reply flows | Medium fit | Clean send API and inbound webhooks, but not really an inbox-native SDR system |
| `Postmark` | Transactional email plus inbound parsing | Weak fit | Excellent delivery and inbound parsing, but not designed as agent inbox infrastructure |
| `Nylas` | User-connected Gmail and Outlook mailboxes | Medium fit | Strong if users connect their own accounts, weaker if you want app-owned agent inboxes |

## Cold Outbound View

For cold outbound specifically, the question is not just "can this provider send email?"

The real question is:

Can it support disciplined outbound with identity, thread continuity, replies, and deliverability controls?

### AgentMail

Best fit among the options reviewed here.

Why:

- supports inbox provisioning
- supports replies and threads
- supports custom domains
- documents warm-up strategy and inbox distribution

That does not mean "plug it in and send cold email recklessly." You still need:

- warmed domains and inboxes
- verified addresses
- low bounce rates
- complaint monitoring
- sane volume controls
- compliance logic where required

### Resend

Can send outbound email and receive replies, but is not the best default for cold outbound.

Why:

- it clearly separates transactional and marketing email
- it emphasizes consent for marketing email
- its product shape is closer to product email plus receiving than SDR inbox infrastructure

It is still useful if your workflow is:

- send emails
- receive replies by webhook
- fetch full body later
- thread replies using message headers

That is workable, but it is not as natural a fit as AgentMail for Trellis.

## Practical Rule of Thumb

Use `AgentMail` when:

- the system should own the inboxes
- the agent is the sender
- you want one provider that matches outbound plus reply handling cleanly

Use `MailSlurp` when:

- you want a close alternative with strong programmable inbox primitives

Use `EmailEngine` when:

- you want to self-host the email control plane
- or you want the agent to act through real existing mailboxes

Use `Resend` or `Postmark` when:

- your needs are closer to application email with inbound processing than full SDR inbox infrastructure

Use `Nylas` when:

- your customers need to connect their own Gmail or Outlook accounts

## Final Recommendation

For Trellis as it exists today:

- `AgentMail` is the best default choice.

Not because it is the best email product in every scenario, but because it is the best fit for this repo's current architecture.

## Sources

- AgentMail: [Messages](https://www.agentmail.to/docs/messages), [Rate Limits](https://www.agentmail.to/docs/knowledge-base/rate-limits), [Warming Up](https://www.agentmail.to/docs/knowledge-base/domain-warming), [Email Protocols](https://www.agentmail.to/docs/email-protocols)
- MailSlurp: [Overview](https://docs.mailslurp.com/overview/), [Inboxes](https://docs.mailslurp.com/inboxes/), [Webhooks](https://docs.mailslurp.com/webhooks/)
- EmailEngine: [Overview](https://learn.emailengine.app/), [Sending](https://learn.emailengine.app/docs/sending), [Receiving](https://learn.emailengine.app/docs/receiving), [Webhooks](https://learn.emailengine.app/docs/webhooks/overview)
- Resend: [Sending feature types](https://resend.com/docs/knowledge-base/what-sending-feature-to-use), [Consent](https://resend.com/docs/knowledge-base/what-counts-as-email-consent), [Receiving](https://resend.com/docs/dashboard/receiving/introduction), [Reply to emails](https://resend.com/docs/dashboard/receiving/reply-to-emails)
- Postmark: [Inbound webhook](https://postmarkapp.com/developer/webhooks/inbound-webhook), [Inbound overview](https://postmarkapp.com/developer/user-guide/inbound)
- Nylas: [Auth](https://v2-5-0.developer.nylas.com/docs/v3/auth/), [Getting started](https://v2-5-0.developer.nylas.com/docs/v3/getting-started/)
