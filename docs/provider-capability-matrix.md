# Trellis Provider Capabilities

Trellis exposes provider capabilities by job, not by vendor. Agents should depend on `mail`, `research`, and `browser` capabilities, while adapters implement those capabilities behind the scenes.

## Public Provider Surface

```ts
import { attio, browser, mail, research } from "@trellis/providers";

export default trellis.agent("sdr", {
  crm: attio(),
  mail: mail(),
  browser: browser({ profiles: browserProfiles }),
  research: research({ profiles: browserProfiles }),
});
```

Use vendor-specific helpers only when an agent intentionally depends on that vendor:

```ts
mail({ adapter: "agentmail" })
research({ adapter: "firecrawl" })
```

## Capability Matrix

| Capability | Default Trellis provider | AgentMail adapter | Firecrawl adapter |
| --- | --- | --- | --- |
| `email.send` | Supported through the Cloudflare Email Service `EMAIL` binding or native mail endpoint | Supported | Not applicable |
| `email.reply` | Supported through the Cloudflare Email Service `EMAIL` binding or native mail endpoint | Supported | Not applicable |
| `email.forward` | Supported through the native email adapter | Adapter-dependent | Not applicable |
| `email.reject` | Supported through the native email adapter | Adapter-dependent | Not applicable |
| `email.preview` | Supported as a Trellis draft before execution | Supported as a Trellis draft before execution | Not applicable |
| `email.inbound` | Supported through the Cloudflare Worker `email()` handler, `/webhooks/email`, and legacy `/webhooks/mail` | Supported through AgentMail webhooks | Not applicable |
| `email.bounce` | Supported through `/webhooks/email` and legacy `/webhooks/mail` lifecycle events | Adapter-dependent | Not applicable |
| `email.suppression.check` | Contracted for suppression checks | Adapter-dependent | Not applicable |
| `research.search` | Contracted for research adapters | Not applicable | Supported |
| `research.map` | Supported through Cloudflare Browser Run links | Not applicable | Supported |
| `research.scrape` | Supported through Cloudflare Browser Run markdown/scrape | Not applicable | Supported |
| `research.extract` | Supported through Cloudflare Browser Run markdown | Not applicable | Supported |
| `research.crawl.start` | Supported through Cloudflare Browser Run crawl | Not applicable | Supported |
| `research.crawl.status` | Contracted for async crawl providers | Not applicable | Supported |
| `browser.screenshot` | Supported through Cloudflare Browser Run screenshot | Not applicable | Adapter-dependent |
| `browser.pdf` | Supported through Cloudflare Browser Run PDF | Not applicable | Adapter-dependent |
| `browser.session.run` | Supported through Cloudflare Browser Run snapshot | Not applicable | Adapter-dependent |
| `browser.interact` | Supported through Cloudflare Browser Run snapshot | Not applicable | Adapter-dependent |

## Design Rule

Research is not browser automation.

`research.*` tools retrieve and normalize information for agent reasoning: links, markdown, facts, crawl results, and citations.

`browser.*` tools control a page or session: screenshots, PDFs, authenticated pages, dynamic waits, clicks, forms, visual QA, and other stateful automation.

`email.*` tools are the public email contract. Native email is the default path; AgentMail is an adapter that maps onto the same Trellis email capabilities.

## Browser Profiles

Browser and research providers can share a profile map:

```ts
import type { TrellisBrowserProfileMap } from "@trellis/gtm";

export default {
  defaultProfile: "research",
  profiles: {
    research: {
      viewport: { width: 1440, height: 1200 },
      locale: "en-US",
      timezoneId: "America/New_York",
      blockedResourceTypes: ["font", "media"],
    },
    qa: {
      viewport: { width: 1280, height: 900 },
      waitFor: "networkidle",
    },
  },
} satisfies TrellisBrowserProfileMap;
```

`research.*` uses profiles for controlled extraction. `browser.*` uses the same profiles for stateful visual and interaction tasks.

## Native Mail Webhooks

Cloudflare-native inbound email enters through the Worker `email()` handler. Native inbound email can also post to `POST /webhooks/email`; `POST /webhooks/mail` remains a legacy alias. Trellis accepts inbound message events as resumable reply signals and records bounce/reject events as email lifecycle trace events. Use `TRELLIS_MAIL_WEBHOOK_SECRET` when the HTTP route should verify a shared secret.
