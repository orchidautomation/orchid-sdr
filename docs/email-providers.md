# Email Providers For Trellis

This page is about one narrow question:

Which email path should a Trellis SDR example use by default?

Short answer:

- Use `mail()` as the default Trellis email contract.
- On Cloudflare, `mail()` maps to Cloudflare Email Service through the `EMAIL` Worker binding.
- Use `mail({ adapter: "agentmail" })` only when the app intentionally wants AgentMail inbox infrastructure.

## Default Path

The default provider is:

```ts
mail()
```

That keeps the example vendor-light at the agent level. The agent asks for Trellis email capabilities like `email.send`, `email.reply`, and `email.inbound`. The Cloudflare Worker supplies the actual primitive:

- outbound sends use the Cloudflare `EMAIL` binding when it is present
- inbound mail can enter through the Worker `email()` handler
- `POST /webhooks/email` remains available for providers or local testing that post JSON events

This matches the rest of the Cloudflare-first stack: D1 for state, R2 for packs/artifacts, Queues for events, Workflows for waits, Browser Run for research/browser actions, and Email Service for mail.

## Optional Adapter

AgentMail is still useful. It is just no longer the default SDR example path.

Use `mail({ adapter: "agentmail" })` when:

- the system should own many inboxes
- inbox provisioning is the product requirement
- the workflow needs AgentMail-specific thread and inbox APIs
- you prefer AgentMail webhooks over Cloudflare Email Routing

## Provider Comparison

| Provider | Best for | Trellis role |
| --- | --- | --- |
| `mail()` on Cloudflare Email Service | Default Cloudflare-native send/receive | Default |
| `AgentMail` | Agent-owned inbox infrastructure | Optional adapter |
| `MailSlurp` | Programmable inbox alternatives | Possible future adapter |
| `EmailEngine` | Existing Gmail/Outlook/IMAP control plane | Possible future adapter |
| `Resend` | Product or transactional email | Possible future adapter |
| `Postmark` | Transactional email plus inbound parsing | Possible future adapter |

## Practical Rule

Use the Cloudflare-native `mail()` default unless the example is specifically teaching a third-party inbox vendor.

If a workflow later needs a vendor, keep the Trellis agent code stable and swap the adapter:

```ts
mail({ adapter: "agentmail" })
```

## Sources

- Cloudflare Email Service: [Workers API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/) and [route emails with Workers](https://developers.cloudflare.com/email-service/api/route-emails/email-handler/)
- AgentMail: [Messages](https://www.agentmail.to/docs/messages), [Rate Limits](https://www.agentmail.to/docs/knowledge-base/rate-limits), [Warming Up](https://www.agentmail.to/docs/knowledge-base/domain-warming), [Email Protocols](https://www.agentmail.to/docs/email-protocols)
