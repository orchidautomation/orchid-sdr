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
| `mail.send` | Supported through the native mail adapter | Supported | Not applicable |
| `mail.reply` | Supported through the native mail adapter | Supported | Not applicable |
| `mail.forward` | Supported through the native mail adapter | Adapter-dependent | Not applicable |
| `mail.reject` | Supported through the native mail adapter | Adapter-dependent | Not applicable |
| `mail.preview` | Supported as a Trellis draft before execution | Supported as a Trellis draft before execution | Not applicable |
| `mail.inbound` | Supported through `/webhooks/mail` | Supported through AgentMail webhooks | Not applicable |
| `mail.bounce` | Supported through `/webhooks/mail` lifecycle events | Adapter-dependent | Not applicable |
| `mail.suppression.check` | Contracted for suppression checks | Adapter-dependent | Not applicable |
| `research.search` | Contracted for research adapters | Not applicable | Supported |
| `research.map` | Supported through Browser Run quick actions | Not applicable | Supported |
| `research.scrape` | Supported through Browser Run quick actions | Not applicable | Supported |
| `research.extract` | Supported through Browser Run quick actions | Not applicable | Supported |
| `research.crawl.start` | Supported through Browser Run quick actions | Not applicable | Supported |
| `research.crawl.status` | Contracted for async crawl providers | Not applicable | Supported |
| `browser.screenshot` | Supported through Browser Run quick actions | Not applicable | Adapter-dependent |
| `browser.pdf` | Supported through Browser Run quick actions | Not applicable | Adapter-dependent |
| `browser.session.run` | Supported through Browser Run session actions | Not applicable | Adapter-dependent |
| `browser.interact` | Supported through Browser Run session actions | Not applicable | Adapter-dependent |

## Design Rule

Research is not browser automation.

`research.*` tools retrieve and normalize information for agent reasoning: links, markdown, facts, crawl results, and citations.

`browser.*` tools control a page or session: screenshots, PDFs, authenticated pages, dynamic waits, clicks, forms, visual QA, and other stateful automation.

`mail.*` tools are the public email contract. Native mail is the default path; AgentMail is an adapter that maps onto the same Trellis mail capabilities.

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

Native inbound mail posts to `POST /webhooks/mail`. Trellis accepts inbound message events as resumable reply signals and records bounce/reject events as mail lifecycle trace events. Use `TRELLIS_MAIL_WEBHOOK_SECRET` when the route should verify a shared secret.
