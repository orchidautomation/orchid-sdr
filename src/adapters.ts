import { getConfig } from "./config.js";
import type { ContactEmail, DiscoverySource, ProspectContext } from "./domain/types.js";

interface ParallelSearchResult {
  title: string;
  url: string;
  excerpt: string;
}

interface FirecrawlSearchResult {
  title: string;
  url: string;
  excerpt: string;
  source: "web" | "news";
}

interface NormalizedSourceSignal {
  sourceRef: string;
  url: string;
  authorName: string;
  authorTitle?: string | null;
  authorCompany?: string | null;
  companyDomain?: string | null;
  topic: string;
  content: string;
  metadata: Record<string, unknown>;
}

interface DiscoveryRunInput {
  campaignId: string;
  source: DiscoverySource;
  term: string;
  metadata?: Record<string, unknown>;
}

interface ApifyRunSnapshot {
  actorRunId: string;
  status: string;
  defaultDatasetId: string | null;
}

export class ApifySourceAdapter {
  private readonly config = getConfig();

  hasDiscoveryTarget(source: DiscoverySource) {
    return Boolean(this.resolveDiscoveryTarget(source));
  }

  async fetchDatasetItems(datasetId: string, source: DiscoverySource = "linkedin_public_post") {
    if (!this.config.APIFY_TOKEN) {
      throw new Error("APIFY_TOKEN is not configured");
    }

    const url = new URL(`${this.config.APIFY_BASE_URL}/datasets/${datasetId}/items`);
    url.searchParams.set("clean", "true");
    url.searchParams.set(
      "limit",
      String(
        source === "x_public_post"
          ? this.config.APIFY_X_DATASET_LIMIT
          : this.config.APIFY_LINKEDIN_DATASET_LIMIT,
      ),
    );
    url.searchParams.set("format", "json");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.APIFY_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Apify dataset fetch failed with ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>[];
  }

  async startDiscoveryRun(input: DiscoveryRunInput) {
    if (!this.config.APIFY_TOKEN) {
      throw new Error("APIFY_TOKEN is not configured");
    }

    const target = this.resolveDiscoveryTarget(input.source);
    if (!target) {
      throw new Error(`Apify target is not configured for ${input.source}`);
    }

    const webhookUrl = new URL(`${this.config.APP_URL}/webhooks/apify`);
    if (this.config.APIFY_WEBHOOK_SECRET) {
      webhookUrl.searchParams.set("secret", this.config.APIFY_WEBHOOK_SECRET);
    }

    const payloadTemplate = [
      "{",
      '"eventType":"{{eventType}}"',
      `,"source":${JSON.stringify(input.source)}`,
      `,"term":${JSON.stringify(input.term)}`,
      `,"campaignId":${JSON.stringify(input.campaignId)}`,
      `,"metadata":${JSON.stringify(input.metadata ?? {})}`,
      ',"resource":{{resource}}',
      "}",
    ].join("");

    const webhooks = Buffer.from(
      JSON.stringify([
        {
          eventTypes: ["ACTOR.RUN.SUCCEEDED"],
          requestUrl: webhookUrl.toString(),
          payloadTemplate,
        },
      ]),
      "utf8",
    ).toString("base64");

    const url = new URL(`${this.config.APIFY_BASE_URL}${target.path}`);
    url.searchParams.set("webhooks", webhooks);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.APIFY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.buildDiscoveryInput(input)),
    });

    if (!response.ok) {
      throw new Error(`Apify discovery run failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const data = coerceRecord(json.data);
    const actorRunId =
      pickString(data, ["id", "actorRunId"]) ?? pickString(json, ["id", "actorRunId"]);
    if (!actorRunId) {
      throw new Error(`Apify did not return an actor run id for ${input.source}`);
    }

    return {
      actorRunId,
      defaultDatasetId:
        pickString(data, ["defaultDatasetId", "defaultDataset_id"]) ??
        pickString(json, ["defaultDatasetId", "defaultDataset_id"]),
      raw: json,
    };
  }

  async getRun(actorRunId: string): Promise<ApifyRunSnapshot> {
    if (!this.config.APIFY_TOKEN) {
      throw new Error("APIFY_TOKEN is not configured");
    }

    const response = await fetch(`${this.config.APIFY_BASE_URL}/actor-runs/${encodeURIComponent(actorRunId)}`, {
      headers: {
        Authorization: `Bearer ${this.config.APIFY_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Apify run fetch failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const data = coerceRecord(json.data);
    const runId = pickString(data, ["id", "actorRunId"]) ?? actorRunId;
    const status = pickString(data, ["status"]) ?? "UNKNOWN";

    return {
      actorRunId: runId,
      status,
      defaultDatasetId:
        pickString(data, ["defaultDatasetId", "defaultDataset_id"]) ??
        pickString(json, ["defaultDatasetId", "defaultDataset_id"]) ??
        null,
    };
  }

  normalizeSignals(source: DiscoverySource, items: Record<string, unknown>[]): NormalizedSourceSignal[] {
    return source === "x_public_post"
      ? this.normalizeXSignals(items)
      : this.normalizeLinkedInSignals(items);
  }

  normalizeLinkedInSignals(items: Record<string, unknown>[]): NormalizedSourceSignal[] {
    return items.map((item, index) => {
      const authorRecord = coerceRecord(item.author);
      const queryRecord = coerceRecord(item.query);
      const headerRecord = coerceRecord(item.header);
      const socialContentRecord = coerceRecord(item.socialContent);

      const authorInfo =
        pickString(authorRecord, ["info", "headline", "description"])
        ?? pickString(headerRecord, ["text"]);
      const author = pickString(item, ["authorName", "name", "fullName"])
        ?? pickString(authorRecord, ["name", "fullName"])
        ?? "Unknown";
      const url =
        pickString(item, ["url", "postUrl", "linkedinUrl"])
        ?? pickString(socialContentRecord, ["shareUrl"])
        ?? `https://linkedin.com/feed/update/${index}`;
      const content = pickString(item, ["text", "content", "postText", "description"]) ?? "";
      const topic =
        pickString(queryRecord, ["search", "keyword"])
        ?? pickString(item, ["topic", "query", "keyword"])
        ?? "linkedin-monitor";
      const company =
        pickString(item, ["company", "companyName"])
        ?? inferCompanyFromHeadline(authorInfo);
      const companyDomain = normalizeDomain(
        pickString(item, ["companyDomain", "website", "domain", "companyWebsite"])
          ?? pickString(authorRecord, ["website"]),
      );

      return {
        sourceRef: pickString(item, ["entityId", "id", "postId", "urn", "shareUrn"]) ?? url,
        url,
        authorName: author,
        authorTitle: pickString(item, ["jobTitle", "title", "headline"]) ?? authorInfo,
        authorCompany: company,
        companyDomain,
        topic,
        content,
        metadata: item,
      };
    });
  }

  normalizeXSignals(items: Record<string, unknown>[]): NormalizedSourceSignal[] {
    return items.map((item, index) => {
      const username = pickString(item, ["authorUsername", "username", "screenName", "handle"]);
      const author =
        pickString(item, ["authorName", "name", "displayName", "author"]) ??
        (username ? `@${username.replace(/^@/, "")}` : "Unknown");
      const url =
        pickString(item, ["url", "tweetUrl", "postUrl"]) ??
        `https://x.com/${username?.replace(/^@/, "") ?? "unknown"}/status/${pickString(item, ["id", "tweetId"]) ?? index}`;
      const content = pickString(item, ["text", "content", "fullText", "description"]) ?? "";
      const topic = pickString(item, ["topic", "query", "keyword"]) ?? "x-monitor";
      const company = pickString(item, ["company", "companyName"]);
      const companyDomain = normalizeDomain(
        pickString(item, ["companyDomain", "website", "domain", "companyWebsite"]),
      );

      return {
        sourceRef: pickString(item, ["id", "tweetId", "restId"]) ?? url,
        url,
        authorName: author,
        authorTitle: pickString(item, ["jobTitle", "title", "headline", "bio"]),
        authorCompany: company,
        companyDomain,
        topic,
        content,
        metadata: item,
      };
    });
  }

  private resolveDiscoveryTarget(source: DiscoverySource) {
    if (source === "x_public_post") {
      if (this.config.APIFY_X_TASK_ID) {
        return { path: `/actor-tasks/${encodeURIComponent(this.config.APIFY_X_TASK_ID)}/runs` };
      }
      if (this.config.APIFY_X_ACTOR_ID) {
        return { path: `/acts/${encodeURIComponent(this.config.APIFY_X_ACTOR_ID)}/runs` };
      }
      return null;
    }

    if (this.config.APIFY_LINKEDIN_TASK_ID) {
      return { path: `/actor-tasks/${encodeURIComponent(this.config.APIFY_LINKEDIN_TASK_ID)}/runs` };
    }
    if (this.config.APIFY_LINKEDIN_ACTOR_ID) {
      return { path: `/acts/${encodeURIComponent(this.config.APIFY_LINKEDIN_ACTOR_ID)}/runs` };
    }

    return null;
  }

  private buildDiscoveryInput(input: DiscoveryRunInput) {
    const template =
      input.source === "x_public_post"
        ? this.config.APIFY_X_INPUT_TEMPLATE
        : this.config.APIFY_LINKEDIN_INPUT_TEMPLATE;

    if (template) {
      const rendered = interpolateTemplate(template, {
        term: input.term,
        campaignId: input.campaignId,
        source: input.source,
        appUrl: this.config.APP_URL,
      });

      try {
        return JSON.parse(rendered) as Record<string, unknown>;
      } catch (error) {
        throw new Error(
          `Invalid Apify input template for ${input.source}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const limit =
      input.source === "x_public_post"
        ? this.config.APIFY_X_DATASET_LIMIT
        : this.config.APIFY_LINKEDIN_DATASET_LIMIT;

    return {
      query: input.term,
      queries: [input.term],
      searchTerms: [input.term],
      keyword: input.term,
      keywords: [input.term],
      limit,
      maxItems: limit,
      max_results: limit,
    };
  }
}

export class ProspeoEmailEnricher {
  private readonly config = getConfig();

  async enrich(prospect: ProspectContext): Promise<ContactEmail | null> {
    if (!this.config.PROSPEO_API_KEY) {
      return null;
    }

    const response = await fetch(`${this.config.PROSPEO_BASE_URL}/enrich-person`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-KEY": this.config.PROSPEO_API_KEY,
      },
      body: JSON.stringify({
        only_verified_email: true,
        data: {
          full_name: prospect.fullName,
          company_website: prospect.companyDomain,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Prospeo enrich-person failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const email = pickString(json, ["email", "work_email"]);
    if (!email) {
      return null;
    }

    return {
      address: email,
      confidence: 0.92,
      source: "prospeo",
    };
  }
}

export class ParallelResearchAdapter {
  private readonly config = getConfig();

  async search(query: string, limit = 5): Promise<ParallelSearchResult[]> {
    if (!this.config.PARALLEL_API_KEY) {
      return [];
    }

    const response = await fetch(`${this.config.PARALLEL_BASE_URL}/v1beta/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.PARALLEL_API_KEY,
      },
      body: JSON.stringify({
        objective: query,
        processor: "fast",
        max_results: limit,
        max_chars_per_result: 1200,
      }),
    });

    if (!response.ok) {
      throw new Error(`Parallel search failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const results = Array.isArray(json.results) ? json.results : [];

    return results.map((result) => ({
      title: pickString(result as Record<string, unknown>, ["title"]) ?? "Untitled",
      url: pickString(result as Record<string, unknown>, ["url"]) ?? "",
      excerpt:
        pickString(result as Record<string, unknown>, ["excerpt", "text", "snippet"]) ?? "",
    }));
  }
}

export class FirecrawlExtractAdapter {
  private readonly config = getConfig();

  async extract(url: string) {
    if (!this.config.FIRECRAWL_API_KEY) {
      return { markdown: "", url };
    }

    const response = await fetch(`${this.config.FIRECRAWL_BASE_URL}/v1/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
      }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl scrape failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    return {
      url,
      markdown: pickString(coerceRecord(json.data), ["markdown"]) ?? "",
    };
  }

  async search(query: string, input?: {
    limit?: number;
    sources?: Array<"web" | "news">;
    tbs?: string;
  }): Promise<FirecrawlSearchResult[]> {
    if (!this.config.FIRECRAWL_API_KEY || !query.trim()) {
      return [];
    }

    const response = await fetch(`${this.config.FIRECRAWL_BASE_URL}/v2/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        limit: input?.limit ?? 5,
        sources: input?.sources ?? ["web"],
        tbs: input?.tbs,
        country: "US",
        ignoreInvalidURLs: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl search failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const data = coerceRecord(json.data);
    const webResults = Array.isArray(data.web) ? data.web : [];
    const newsResults = Array.isArray(data.news) ? data.news : [];

    return [
      ...webResults.map((result) => this.mapFirecrawlSearchResult(result as Record<string, unknown>, "web")),
      ...newsResults.map((result) => this.mapFirecrawlSearchResult(result as Record<string, unknown>, "news")),
    ].filter((result) => Boolean(result.url));
  }

  async searchCompanyNews(company: string | null, domain: string | null, limit = 3) {
    const query = [company, domain, "news"].filter(Boolean).join(" ").trim();
    if (!query) {
      return [];
    }

    return this.search(query, {
      limit,
      sources: ["news"],
    });
  }

  private mapFirecrawlSearchResult(result: Record<string, unknown>, source: "web" | "news"): FirecrawlSearchResult {
    return {
      title: pickString(result, ["title"]) ?? "Untitled",
      url: pickString(result, ["url"]) ?? "",
      excerpt: pickString(result, ["description", "excerpt", "snippet"]) ?? "",
      source,
    };
  }
}

export class AgentMailAdapter {
  private readonly config = getConfig();

  async send(input: {
    to: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string | null;
    threadId?: string | null;
  }) {
    if (!this.config.AGENTMAIL_API_KEY) {
      throw new Error("AGENTMAIL_API_KEY is not configured");
    }

    const response = await fetch(`${this.config.AGENTMAIL_BASE_URL}/v0/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.AGENTMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        to: [input.to],
        subject: input.subject,
        text: input.bodyText,
        html: input.bodyHtml ?? undefined,
        thread_id: input.threadId ?? undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`AgentMail send failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    return {
      providerMessageId: pickString(json, ["id", "message_id"]),
      providerThreadId: pickString(json, ["thread_id", "threadId"]),
      raw: json,
    };
  }

  async reply(input: {
    threadId: string;
    bodyText: string;
    bodyHtml?: string | null;
    subject?: string | null;
  }) {
    if (!this.config.AGENTMAIL_API_KEY) {
      throw new Error("AGENTMAIL_API_KEY is not configured");
    }

    const response = await fetch(
      `${this.config.AGENTMAIL_BASE_URL}/v0/threads/${encodeURIComponent(input.threadId)}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.AGENTMAIL_API_KEY}`,
        },
        body: JSON.stringify({
          text: input.bodyText,
          html: input.bodyHtml ?? undefined,
          subject: input.subject ?? undefined,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`AgentMail reply failed with ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    return {
      providerMessageId: pickString(json, ["id", "message_id"]),
      providerThreadId: pickString(json, ["thread_id", "threadId"]) ?? input.threadId,
      raw: json,
    };
  }
}

export class SlackWebhookAdapter {
  private readonly config = getConfig();

  async notify(channel: string | undefined, text: string, metadata: Record<string, unknown>) {
    if (!this.config.SLACK_WEBHOOK_URL) {
      return {
        status: "skipped",
        reason: "SLACK_WEBHOOK_URL not configured",
      };
    }

    const response = await fetch(this.config.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channel ?? this.config.SLACK_DEFAULT_CHANNEL,
        text,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed with ${response.status}`);
    }

    return {
      status: "sent",
    };
  }
}

function pickString(input: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function normalizeDomain(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const normalized = value.startsWith("http") ? new URL(value).hostname : value;
    return normalized.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^www\./, "").toLowerCase();
  }
}

function coerceRecord(value: unknown) {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function inferCompanyFromHeadline(value: string | null) {
  if (!value) {
    return null;
  }

  const patterns = [
    /\bat\s+([^|,@]+)$/i,
    /\bat\s+([^|,@]+)/i,
    /@\s*([^|,]+)/,
    /\b(?:founder|co-founder|ceo|cto|cro|cmo|head|director|vp|lead)\s+of\s+([^|,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate) {
      return candidate.replace(/\s+/g, " ");
    }
  }

  return null;
}

function interpolateTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}
