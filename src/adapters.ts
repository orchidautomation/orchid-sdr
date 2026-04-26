import { getConfig } from "./config.js";
import type { ContactEmail, DiscoverySource, ProspectContext } from "./domain/types.js";
import type {
  BasicResearchSearchProvider,
  ConfigurableResearchSearchProvider,
  CrmProvider,
  DiscoveryRunInput,
  DiscoveryRunSnapshot,
  DiscoverySignalSourceAdapter,
  EmailEnrichmentProvider,
  HandoffProvider,
  OutboundEmailProvider,
  ProviderSignal,
  WebExtractProvider,
} from "@ai-sdr/framework";

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

interface AttioRecordReference {
  recordId: string;
  webUrl: string | null;
  raw: Record<string, unknown>;
}

interface AttioListEntryReference {
  entryId: string;
  listId: string;
  parentRecordId: string;
  parentObject: string;
  raw: Record<string, unknown>;
}

export class ApifySourceAdapter implements DiscoverySignalSourceAdapter<DiscoverySource> {
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

  async startDiscoveryRun(input: DiscoveryRunInput<DiscoverySource>) {
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

  async getRun(actorRunId: string): Promise<DiscoveryRunSnapshot> {
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

  normalizeSignals(source: DiscoverySource, items: Record<string, unknown>[]): ProviderSignal[] {
    return source === "x_public_post"
      ? this.normalizeXSignals(items)
      : this.normalizeLinkedInSignals(items);
  }

  normalizeLinkedInSignals(items: Record<string, unknown>[]): ProviderSignal[] {
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

  normalizeXSignals(items: Record<string, unknown>[]): ProviderSignal[] {
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

export class ProspeoEmailEnricher implements EmailEnrichmentProvider<ProspectContext> {
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

export class ParallelResearchAdapter implements BasicResearchSearchProvider {
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

export class FirecrawlExtractAdapter implements WebExtractProvider, ConfigurableResearchSearchProvider {
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

export class AttioAdapter implements CrmProvider {
  private readonly config = getConfig();

  isConfigured() {
    return Boolean(this.config.ATTIO_API_KEY);
  }

  async upsertCompany(input: {
    name: string | null;
    domain: string | null;
    recordId?: string | null;
  }): Promise<(AttioRecordReference & { mode: "assert" | "query" | "create" | "update"; matchedBy: string; warnings: string[] }) | null> {
    const domain = normalizeDomain(input.domain);
    const name = input.name?.trim() || null;
    if (!domain && !name) {
      return null;
    }

    const values: Record<string, unknown> = {};
    if (domain) {
      values.domains = [domain];
    }
    if (name) {
      values.name = name;
    }

    if (input.recordId) {
      await this.updateRecord("companies", input.recordId, values);
      return {
        mode: "update",
        matchedBy: "record_id",
        warnings: [],
        recordId: input.recordId,
        webUrl: null,
        raw: {},
      };
    }

    if (!domain && name) {
      const matches = await this.queryRecords("companies", {
        name,
      });
      if (matches.length > 0) {
        const match = matches[0]!;
        return {
          mode: "query",
          matchedBy: "name",
          warnings:
            matches.length > 1
              ? [`multiple Attio companies matched by exact name "${name}"; reused the first match`]
              : [],
          ...match,
        };
      }
    }

    const response = domain
      ? await this.request(`/objects/companies/records?matching_attribute=domains`, "PUT", {
          data: { values },
        })
      : await this.request(`/objects/companies/records`, "POST", {
          data: { values },
        });

    return {
      mode: domain ? "assert" : "create",
      matchedBy: domain ? "domain" : "name",
      warnings: [],
      ...this.mapRecordResponse(response),
    };
  }

  async upsertPerson(input: {
    fullName: string;
    title: string | null;
    email: string | null;
    linkedinUrl: string | null;
    twitterUrl: string | null;
    companyRecordId: string | null;
    companyDomain: string | null;
    recordId?: string | null;
  }): Promise<AttioRecordReference & { mode: "assert" | "query" | "create" | "update"; matchedBy: string; warnings: string[] }> {
    const email = input.email?.trim() || null;
    const linkedinUrl = canonicalizeLinkedinUrl(input.linkedinUrl);
    const twitterUrl = canonicalizeTwitterProfileUrl(input.twitterUrl);
    const { firstName, lastName, fullName } = splitFullName(input.fullName);
    const values: Record<string, unknown> = {
      name: [
        {
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
        },
      ],
    };

    if (input.title?.trim()) {
      values.job_title = input.title.trim();
    }
    if (linkedinUrl) {
      values.linkedin = linkedinUrl;
    }
    if (twitterUrl) {
      values.twitter = twitterUrl;
    }
    if (email) {
      values.email_addresses = [email];
    }

    const companyDomain = normalizeDomain(input.companyDomain);
    if (input.companyRecordId) {
      values.company = [
        {
          target_object: "companies",
          target_record_id: input.companyRecordId,
        },
      ];
    } else if (companyDomain) {
      values.company = [
        {
          target_object: "companies",
          domains: [
            {
              domain: companyDomain,
            },
          ],
        },
      ];
    }

    if (input.recordId) {
      await this.updateRecord("people", input.recordId, values);
      return {
        mode: "update",
        matchedBy: "record_id",
        warnings: [],
        recordId: input.recordId,
        webUrl: null,
        raw: {},
      };
    }

    if (email) {
      const response = await this.request(`/objects/people/records?matching_attribute=email_addresses`, "PUT", {
        data: { values },
      });

      return {
        mode: "assert",
        matchedBy: "email",
        warnings: [],
        ...this.mapRecordResponse(response),
      };
    }

    if (linkedinUrl) {
      const matches = await this.queryRecords("people", {
        linkedin: linkedinUrl,
      });
      if (matches.length > 0) {
        const match = matches[0]!;
        await this.updateRecord("people", match.recordId, values);
        return {
          mode: "query",
          matchedBy: "linkedin",
          warnings:
            matches.length > 1
              ? [`multiple Attio people matched by LinkedIn URL; updated the first match only`]
              : [],
          ...match,
        };
      }
    }

    if (twitterUrl) {
      const matches = await this.queryRecords("people", {
        twitter: twitterUrl,
      });
      if (matches.length > 0) {
        const match = matches[0]!;
        await this.updateRecord("people", match.recordId, values);
        return {
          mode: "query",
          matchedBy: "twitter",
          warnings:
            matches.length > 1
              ? [`multiple Attio people matched by Twitter/X URL; updated the first match only`]
              : [],
          ...match,
        };
      }
    }

    if (input.companyRecordId) {
      const matches = await this.queryRecords("people", {
        $and: [
          {
            name: {
              full_name: {
                $eq: fullName,
              },
            },
          },
          {
            company: {
              target_object: "companies",
              target_record_id: input.companyRecordId,
            },
          },
        ],
      });

      if (matches.length > 0) {
        const match = matches[0]!;
        await this.updateRecord("people", match.recordId, values);
        return {
          mode: "query",
          matchedBy: "name+company",
          warnings:
            matches.length > 1
              ? [`multiple Attio people matched by exact name and company; updated the first match only`]
              : [],
          ...match,
        };
      }
    }

    const response = await this.request(`/objects/people/records`, "POST", {
      data: { values },
    });

    return {
      mode: "create",
      matchedBy: linkedinUrl ? "linkedin-fallback" : twitterUrl ? "twitter-fallback" : "create",
      warnings: [],
      ...this.mapRecordResponse(response),
    };
  }

  async createNote(input: {
    parentObject: "people" | "companies";
    parentRecordId: string;
    title: string;
    content: string;
  }) {
    const response = await this.request(`/notes`, "POST", {
      data: {
        parent_object: input.parentObject,
        parent_record_id: input.parentRecordId,
        title: input.title,
        format: "plaintext",
        content: input.content,
      },
    });
    const data = coerceRecord(response.data);
    const id = coerceRecord(data.id);

    return {
      noteId: pickString(id, ["note_id", "id"]),
      raw: response,
    };
  }

  async getList(listId: string) {
    const response = await this.request(`/lists/${encodeURIComponent(listId)}`, "GET");
    const data = coerceRecord(response.data);
    const id = coerceRecord(data.id);
    const parentObject = Array.isArray(data.parent_object)
      ? data.parent_object.filter((value): value is string => typeof value === "string")
      : [];

    return {
      listId: pickString(id, ["list_id", "id"]) ?? listId,
      name: pickString(data, ["name"]) ?? "Unknown list",
      parentObject,
      raw: response,
    };
  }

  async listStatuses(listId: string, attribute = "status") {
    const response = await this.request(`/lists/${encodeURIComponent(listId)}/attributes/${encodeURIComponent(attribute)}/statuses`, "GET");
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map((status) => {
      const record = coerceRecord(status);
      const id = coerceRecord(record.id);
      return {
        statusId: pickString(id, ["status_id", "id"]) ?? "",
        title: pickString(record, ["title"]) ?? "",
        isArchived: Boolean(record.is_archived),
      };
    });
  }

  async listAttributes(listId: string) {
    const response = await this.request(`/lists/${encodeURIComponent(listId)}/attributes`, "GET");
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map((attribute) => {
      const record = coerceRecord(attribute);
      const id = coerceRecord(record.id);
      const config = coerceRecord(record.config);
      const recordReference = coerceRecord(config.record_reference);
      return {
        attributeId: pickString(id, ["attribute_id", "id"]) ?? "",
        title: pickString(record, ["title"]) ?? "",
        apiSlug: pickString(record, ["api_slug"]) ?? "",
        type: pickString(record, ["type"]) ?? "",
        isWritable: Boolean(record.is_writable),
        isMultiselect: Boolean(record.is_multiselect),
        allowedObjectIds: Array.isArray(recordReference.allowed_object_ids)
          ? recordReference.allowed_object_ids.filter((value): value is string => typeof value === "string")
          : [],
      };
    });
  }

  async listRecordEntries(object: "companies" | "people", recordId: string) {
    const response = await this.request(`/objects/${object}/records/${encodeURIComponent(recordId)}/entries`, "GET");
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map((entry) => {
      const record = coerceRecord(entry);
      return {
        listId: pickString(record, ["list_id"]) ?? "",
        listApiSlug: pickString(record, ["list_api_slug"]),
        entryId: pickString(record, ["entry_id"]) ?? "",
        createdAt: pickString(record, ["created_at"]),
        raw: record,
      };
    });
  }

  async assertCompanyInList(input: {
    listId: string;
    companyRecordId: string;
    entryValues?: Record<string, unknown>;
  }) {
    const response = await this.request(`/lists/${encodeURIComponent(input.listId)}/entries`, "PUT", {
      data: {
        parent_record_id: input.companyRecordId,
        parent_object: "companies",
        entry_values: input.entryValues ?? {},
      },
    });
    return this.mapListEntryResponse(response);
  }

  private mapRecordResponse(response: Record<string, unknown>): AttioRecordReference {
    const data = coerceRecord(response.data);
    const id = coerceRecord(data.id);

    return {
      recordId: pickString(id, ["record_id", "id"]) ?? "",
      webUrl: pickString(data, ["web_url"]),
      raw: response,
    };
  }

  private mapListEntryResponse(response: Record<string, unknown>): AttioListEntryReference {
    const data = coerceRecord(response.data);
    const id = coerceRecord(data.id);

    return {
      entryId: pickString(id, ["entry_id", "id"]) ?? "",
      listId: pickString(id, ["list_id"]) ?? "",
      parentRecordId: pickString(data, ["parent_record_id"]) ?? "",
      parentObject: pickString(data, ["parent_object"]) ?? "",
      raw: response,
    };
  }

  private async queryRecords(object: "people" | "companies", filter: Record<string, unknown>) {
    const response = await this.request(`/objects/${object}/records/query`, "POST", {
      filter,
      limit: 3,
      offset: 0,
    });
    const data = Array.isArray(response.data) ? response.data : [];
    return data.map((record) => {
      const item = coerceRecord(record);
      const id = coerceRecord(item.id);
      return {
        recordId: pickString(id, ["record_id", "id"]) ?? "",
        webUrl: pickString(item, ["web_url"]),
        raw: item,
      };
    }).filter((record) => Boolean(record.recordId));
  }

  private async updateRecord(object: "people" | "companies", recordId: string, values: Record<string, unknown>) {
    const response = await this.request(`/objects/${object}/records/${encodeURIComponent(recordId)}`, "PATCH", {
      data: {
        values,
      },
    });
    return this.mapRecordResponse(response);
  }

  private async request(path: string, method: "GET" | "POST" | "PUT" | "PATCH", body?: Record<string, unknown>) {
    if (!this.config.ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY is not configured");
    }

    const response = await fetch(`${this.config.ATTIO_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.ATTIO_API_KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Attio request failed with ${response.status}: ${text}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

export class AgentMailAdapter implements OutboundEmailProvider {
  private readonly config = getConfig();

  isConfigured() {
    return Boolean(this.config.AGENTMAIL_API_KEY);
  }

  async createInbox(input: {
    displayName?: string | null;
    clientId?: string | null;
    username?: string | null;
    domain?: string | null;
  }) {
    const json = await this.request("/v0/inboxes", {
      display_name: input.displayName ?? undefined,
      client_id: input.clientId ?? undefined,
      username: input.username ?? undefined,
      domain: input.domain ?? undefined,
    });

    return {
      providerInboxId: pickString(json, ["inbox_id", "inboxId", "id"]),
      email: pickString(json, ["email"]),
      displayName: pickString(json, ["display_name", "displayName"]),
      raw: json,
    };
  }

  async getInbox(inboxId: string) {
    const json = await this.request(
      "/v0/inboxes/" + encodeURIComponent(inboxId),
      undefined,
      "GET",
    );
    return {
      providerInboxId: pickString(json, ["inbox_id", "inboxId", "id"]),
      email: pickString(json, ["email"]),
      displayName: pickString(json, ["display_name", "displayName"]),
      raw: json,
    };
  }

  async send(input: {
    inboxId: string;
    to: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string | null;
  }) {
    const json = await this.request(`/v0/inboxes/${encodeURIComponent(input.inboxId)}/messages/send`, {
      to: [input.to],
      subject: input.subject,
      text: input.bodyText,
      html: input.bodyHtml ?? undefined,
    });
    return {
      providerMessageId: pickString(json, ["id", "message_id"]),
      providerThreadId: pickString(json, ["thread_id", "threadId"]),
      providerInboxId: input.inboxId,
      raw: json,
    };
  }

  async reply(input: {
    inboxId: string;
    messageId: string;
    bodyText: string;
    bodyHtml?: string | null;
    subject?: string | null;
    replyAll?: boolean;
  }) {
    const path = `/v0/inboxes/${encodeURIComponent(input.inboxId)}/messages/${encodeURIComponent(input.messageId)}/${input.replyAll === false ? "reply" : "reply-all"}`;
    const json = await this.request(path, {
      text: input.bodyText,
      html: input.bodyHtml ?? undefined,
      subject: input.subject ?? undefined,
    });
    return {
      providerMessageId: pickString(json, ["id", "message_id"]),
      providerThreadId: pickString(json, ["thread_id", "threadId"]),
      providerInboxId: input.inboxId,
      raw: json,
    };
  }

  async getMessage(inboxId: string, messageId: string) {
    const json = await this.request(
      `/v0/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}`,
      undefined,
      "GET",
    );
    return {
      providerInboxId: pickString(json, ["inbox_id", "inboxId"]),
      providerThreadId: pickString(json, ["thread_id", "threadId"]),
      providerMessageId: pickString(json, ["message_id", "messageId", "id"]),
      subject: pickString(json, ["subject"]),
      bodyText:
        pickString(json, ["text", "extracted_text", "preview"]) ?? "",
      bodyHtml: pickString(json, ["html", "extracted_html"]),
      raw: json,
    };
  }

  private async request(path: string, body?: Record<string, unknown>, method: "GET" | "POST" = "POST") {
    if (!this.config.AGENTMAIL_API_KEY) {
      throw new Error("AGENTMAIL_API_KEY is not configured");
    }

    const response = await fetch(`${this.config.AGENTMAIL_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.AGENTMAIL_API_KEY}`,
      },
      body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AgentMail request failed with ${response.status}: ${text}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }
}

export class SlackWebhookAdapter implements HandoffProvider {
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

function canonicalizeLinkedinUrl(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "linkedin.com") {
      return value.trim();
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//www.linkedin.com${pathname}`;
  } catch {
    return value.trim();
  }
}

function canonicalizeTwitterProfileUrl(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "x.com" && host !== "twitter.com") {
      return value.trim();
    }

    const [handle] = url.pathname.split("/").filter(Boolean);
    if (!handle) {
      return value.trim();
    }

    return `https://x.com/${handle.replace(/^@/, "")}`;
  } catch {
    return value.trim();
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

function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return {
      firstName: "Unknown",
      lastName: "",
      fullName: "Unknown",
    };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
      fullName: normalized,
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: normalized,
  };
}

function interpolateTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
}
