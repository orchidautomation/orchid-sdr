import type { Pool } from "pg";

import { getDb } from "./db/client.js";
import { getConfig } from "./config.js";
import { createId } from "./lib/ids.js";
import { extractCompanyResearchUrl, extractLinkedinProfileUrl, extractTwitterProfileUrl } from "./lib/signal-urls.js";
import type {
  CampaignSenderIdentity,
  ContactEmail,
  InternalEventName,
  LifecycleStage,
  ProspectContext,
  QualificationAssessment,
  ReplyClass,
  ResearchBrief,
  SendKind,
  SignalRecord,
  ThreadStatus,
} from "./domain/types.js";

export interface CampaignPolicy extends CampaignSenderIdentity {
  id: string;
  name: string;
  status: string;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
  touchCap: number;
  emailConfidenceThreshold: number;
  researchConfidenceThreshold: number;
  sourceLinkedinEnabled: boolean;
}

export interface ControlFlags {
  globalKillSwitch: boolean;
  noSendsMode: boolean;
  pausedCampaignIds: string[];
}

export interface DashboardSummary {
  signals: number;
  prospects: number;
  qualifiedLeads: number;
  activeThreads: number;
  pausedThreads: number;
  providerRuns24h: number;
  globalKillSwitch: boolean;
  noSendsMode: boolean;
}

export interface DashboardSignalRow {
  id: string;
  source: string;
  topic: string;
  authorName: string;
  authorCompany: string | null;
  url: string;
  capturedAt: string;
}

export interface DashboardProspectRow {
  id: string;
  fullName: string;
  company: string | null;
  title: string | null;
  stage: string;
  status: string;
  isQualified: boolean;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  pausedReason: string | null;
  updatedAt: string;
}

export interface DashboardQualifiedLeadRow {
  prospectId: string;
  fullName: string;
  company: string | null;
  title: string | null;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  threadStatus: string;
  researchConfidence: number | null;
  email: string | null;
  emailConfidence: number | null;
  updatedAt: string;
}

export interface DashboardActiveThreadRow {
  threadId: string;
  prospectId: string;
  fullName: string;
  company: string | null;
  title: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  stage: string;
  status: string;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  nextFollowUpAt: string | null;
  updatedAt: string;
}

export interface DashboardProviderRunRow {
  id: string;
  provider: string;
  kind: string;
  externalId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  durationMs: number | null;
  requestTerm: string | null;
  error: string | null;
}

export interface DashboardAuditEventRow {
  id: string;
  entityType: string;
  entityId: string;
  eventName: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProspectSnapshot {
  prospect: ProspectContext;
  qualificationReason: string | null;
  qualification: QualificationAssessment | null;
  campaign: CampaignPolicy;
  thread: {
    id: string;
    stage: LifecycleStage;
    status: ThreadStatus;
    lastReplyClass: ReplyClass | null;
    pausedReason: string | null;
    nextFollowUpAt: string | null;
    providerThreadId: string | null;
    providerInboxId: string | null;
  };
  email: ContactEmail | null;
  researchBrief: ResearchBrief | null;
  messages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    kind: string;
    subject: string | null;
    bodyText: string;
    classification: ReplyClass | null;
    createdAt: string;
  }>;
}

export interface MessageInsertInput {
  threadId: string;
  providerMessageId?: string | null;
  direction: "inbound" | "outbound";
  kind: string;
  subject?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  classification?: ReplyClass | null;
  metadata?: Record<string, unknown>;
}

type SignalRow = {
  id: string;
  source: string;
  source_ref: string;
  actor_run_id: string | null;
  url: string;
  author_name: string;
  author_title: string | null;
  author_company: string | null;
  company_domain: string | null;
  twitter_url: string | null;
  topic: string;
  content: string;
  captured_at: Date;
  metadata: Record<string, unknown>;
};

const DEFAULT_CAMPAIGN_ID = "cmp_default";

function nowIso() {
  return new Date().toISOString();
}

function coerceJson<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") {
    return value as T;
  }
  return fallback;
}

function coerceQualification(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as QualificationAssessment;
}

function normalizeDomain(domain: string | null | undefined) {
  return domain?.trim().toLowerCase() || null;
}

export class TrellisRepository {
  constructor(private readonly db: Pool = getDb()) {}

  async ensureDefaultCampaign() {
    await this.db.query(
      `
      insert into campaigns (
        id,
        name,
        status,
        timezone,
        quiet_hours_start,
        quiet_hours_end,
        touch_cap,
        email_confidence_threshold,
        research_confidence_threshold,
        source_linkedin_enabled
      )
      values ($1, $2, 'active', $3, 21, 8, 5, 0.75, 0.65, true)
      on conflict (id) do nothing
      `,
      [DEFAULT_CAMPAIGN_ID, "Default SDR Campaign", getConfig().DEFAULT_CAMPAIGN_TIMEZONE],
    );

    return this.getCampaign(DEFAULT_CAMPAIGN_ID);
  }

  async getCampaign(campaignId: string): Promise<CampaignPolicy> {
    const result = await this.db.query(
      `
      select
        id,
        name,
        status,
        timezone,
        quiet_hours_start,
        quiet_hours_end,
        touch_cap,
        email_confidence_threshold,
        research_confidence_threshold,
        source_linkedin_enabled,
        sender_email,
        sender_display_name,
        sender_provider_inbox_id
      from campaigns
      where id = $1
      `,
      [campaignId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`campaign ${campaignId} not found`);
    }

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      timezone: row.timezone,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      touchCap: row.touch_cap,
      emailConfidenceThreshold: Number(row.email_confidence_threshold),
      researchConfidenceThreshold: Number(row.research_confidence_threshold),
      sourceLinkedinEnabled: Boolean(row.source_linkedin_enabled),
      senderEmail: row.sender_email,
      senderDisplayName: row.sender_display_name,
      senderProviderInboxId: row.sender_provider_inbox_id,
    };
  }

  async getControlFlags(): Promise<ControlFlags> {
    const result = await this.db.query(`select key, value from control_flags`);
    const map = new Map(result.rows.map((row) => [row.key as string, row.value as Record<string, unknown>]));

    return {
      globalKillSwitch: Boolean(map.get("global_kill_switch")?.enabled),
      noSendsMode: Boolean(map.get("no_sends_mode")?.enabled),
      pausedCampaignIds: Array.isArray(map.get("paused_campaigns")?.campaignIds)
        ? (map.get("paused_campaigns")?.campaignIds as string[])
        : [],
    };
  }

  async setControlFlag(key: string, value: Record<string, unknown>) {
    await this.db.query(
      `
      insert into control_flags (key, value, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key)
      do update set value = excluded.value, updated_at = excluded.updated_at
      `,
      [key, JSON.stringify(value)],
    );
  }

  async setCampaignLinkedinSource(campaignId: string, enabled: boolean) {
    await this.db.query(
      `
      update campaigns
      set source_linkedin_enabled = $2,
          updated_at = now()
      where id = $1
      `,
      [campaignId, enabled],
    );
  }

  async setCampaignTimezone(campaignId: string, timezone: string) {
    await this.db.query(
      `
      update campaigns
      set timezone = $2,
          updated_at = now()
      where id = $1
      `,
      [campaignId, timezone],
    );
  }

  async updateCampaignSenderIdentity(input: {
    campaignId: string;
    senderEmail?: string | null;
    senderDisplayName?: string | null;
    senderProviderInboxId?: string | null;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [input.campaignId];
    let index = 2;

    if (input.senderEmail !== undefined) {
      fields.push(`sender_email = $${index++}`);
      values.push(input.senderEmail);
    }
    if (input.senderDisplayName !== undefined) {
      fields.push(`sender_display_name = $${index++}`);
      values.push(input.senderDisplayName);
    }
    if (input.senderProviderInboxId !== undefined) {
      fields.push(`sender_provider_inbox_id = $${index++}`);
      values.push(input.senderProviderInboxId);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push(`updated_at = now()`);

    await this.db.query(
      `
      update campaigns
      set ${fields.join(", ")}
      where id = $1
      `,
      values,
    );
  }

  async getDashboardSummary(): Promise<DashboardSummary> {
    const [countsResult, flags] = await Promise.all([
      this.db.query(
        `
        select
          (select count(*)::int from signals) as signals,
          (select count(*)::int from prospects) as prospects,
          (select count(*)::int from qualified_leads) as qualified_leads,
          (select count(*)::int from threads where status = 'active') as active_threads,
          (select count(*)::int from threads where status = 'paused') as paused_threads,
          (
            select count(*)::int
            from provider_runs
            where created_at >= now() - interval '24 hours'
          ) as provider_runs_24h
        `,
      ),
      this.getControlFlags(),
    ]);

    const row = countsResult.rows[0];
    return {
      signals: Number(row?.signals ?? 0),
      prospects: Number(row?.prospects ?? 0),
      qualifiedLeads: Number(row?.qualified_leads ?? 0),
      activeThreads: Number(row?.active_threads ?? 0),
      pausedThreads: Number(row?.paused_threads ?? 0),
      providerRuns24h: Number(row?.provider_runs_24h ?? 0),
      globalKillSwitch: flags.globalKillSwitch,
      noSendsMode: flags.noSendsMode,
    };
  }

  async listRecentSignals(limit = 20): Promise<DashboardSignalRow[]> {
    const result = await this.db.query(
      `
      select id, source, topic, author_name, author_company, url, captured_at
      from signals
      order by captured_at desc
      limit $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      source: row.source,
      topic: row.topic,
      authorName: row.author_name,
      authorCompany: row.author_company,
      url: row.url,
      capturedAt: new Date(row.captured_at).toISOString(),
    }));
  }

  async listRecentProspects(limit = 20): Promise<DashboardProspectRow[]> {
    const result = await this.db.query(
      `
      select
        id,
        full_name,
        company,
        title,
        stage,
        status,
        is_qualified,
        qualification_reason,
        metadata->'qualification' as qualification,
        paused_reason,
        updated_at
      from prospects
      order by updated_at desc
      limit $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      company: row.company,
      title: row.title,
      stage: row.stage,
      status: row.status,
      isQualified: Boolean(row.is_qualified),
      qualificationReason: row.qualification_reason,
      qualification: coerceQualification(row.qualification),
      pausedReason: row.paused_reason,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  async getProspectDashboardRow(prospectId: string): Promise<DashboardProspectRow | null> {
    const result = await this.db.query(
      `
      select
        id,
        full_name,
        company,
        title,
        stage,
        status,
        is_qualified,
        qualification_reason,
        metadata->'qualification' as qualification,
        paused_reason,
        updated_at
      from prospects
      where id = $1
      limit 1
      `,
      [prospectId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      fullName: row.full_name,
      company: row.company,
      title: row.title,
      stage: row.stage,
      status: row.status,
      isQualified: Boolean(row.is_qualified),
      qualificationReason: row.qualification_reason,
      qualification: coerceQualification(row.qualification),
      pausedReason: row.paused_reason,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async listQualifiedLeads(limit = 20): Promise<DashboardQualifiedLeadRow[]> {
    const result = await this.db.query(
      `
      select ql.*, p.metadata->'qualification' as qualification
      from qualified_leads ql
      join prospects p on p.id = ql.prospect_id
      order by ql.updated_at desc
      limit $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      prospectId: row.prospect_id as string,
      fullName: row.full_name as string,
      company: row.company as string | null,
      title: row.title as string | null,
      qualificationReason: row.qualification_reason as string | null,
      qualification: coerceQualification(row.qualification),
      threadStatus: row.thread_status as string,
      researchConfidence: row.research_confidence === null ? null : Number(row.research_confidence),
      email: row.email as string | null,
      emailConfidence: row.email_confidence === null ? null : Number(row.email_confidence),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  async listActiveThreads(limit = 20): Promise<DashboardActiveThreadRow[]> {
    const result = await this.db.query(
      `
      select
        t.id as thread_id,
        p.id as prospect_id,
        p.full_name,
        p.company,
        p.title,
        p.linkedin_url,
        p.twitter_url,
        t.stage,
        t.status,
        p.qualification_reason,
        p.metadata->'qualification' as qualification,
        t.next_follow_up_at,
        p.updated_at
      from threads t
      join prospects p on p.id = t.prospect_id
      where t.status = 'active'
      order by p.updated_at desc
      limit $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      threadId: row.thread_id as string,
      prospectId: row.prospect_id as string,
      fullName: row.full_name as string,
      company: row.company as string | null,
      title: row.title as string | null,
      linkedinUrl: row.linkedin_url as string | null,
      twitterUrl: row.twitter_url as string | null,
      stage: row.stage as string,
      status: row.status as string,
      qualificationReason: row.qualification_reason as string | null,
      qualification: coerceQualification(row.qualification),
      nextFollowUpAt: row.next_follow_up_at ? new Date(row.next_follow_up_at).toISOString() : null,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  async listRecentProviderRuns(limit = 20): Promise<DashboardProviderRunRow[]> {
    const result = await this.db.query(
      `
      select
        id,
        provider,
        kind,
        external_id,
        status,
        created_at,
        updated_at,
        request_payload->>'term' as request_term,
        response_payload->>'error' as error,
        case
          when status in ('succeeded', 'failed', 'aborted', 'timed_out', 'completed')
            then greatest(0, floor(extract(epoch from (updated_at - created_at)) * 1000))::bigint
          else null
        end as duration_ms
      from provider_runs
      order by created_at desc
      limit $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      kind: row.kind,
      externalId: row.external_id,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
      requestTerm: row.request_term,
      error: row.error,
    }));
  }

  async listRecentAuditEvents(limit = 30): Promise<DashboardAuditEventRow[]> {
    const result = await this.db.query(
      `
      select id, entity_type, entity_id, event_name, payload, created_at
      from audit_events
      order by created_at desc
      limit $1
      `,
      [limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventName: row.event_name,
      payload: coerceJson<Record<string, unknown>>(row.payload, {}),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async listAuditEventsForEntity(
    entityType: string,
    entityId: string,
    limit = 20,
  ): Promise<DashboardAuditEventRow[]> {
    const result = await this.db.query(
      `
      select id, entity_type, entity_id, event_name, payload, created_at
      from audit_events
      where entity_type = $1 and entity_id = $2
      order by created_at desc
      limit $3
      `,
      [entityType, entityId, limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      eventName: row.event_name,
      payload: coerceJson<Record<string, unknown>>(row.payload, {}),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async recordProviderRun(input: {
    provider: string;
    kind: string;
    externalId?: string | null;
    status: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
  }) {
    const id = createId("prun");
    await this.db.query(
      `
      insert into provider_runs (
        id, provider, kind, external_id, status, request_payload, response_payload, created_at, updated_at
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now(), now())
      `,
      [
        id,
        input.provider,
        input.kind,
        input.externalId ?? null,
        input.status,
        JSON.stringify(input.requestPayload ?? {}),
        JSON.stringify(input.responsePayload ?? {}),
      ],
    );
    return id;
  }

  async updateProviderRun(
    id: string,
    input: {
      status: string;
      responsePayload?: Record<string, unknown>;
    },
  ) {
    await this.db.query(
      `
      update provider_runs
      set status = $2,
          response_payload = $3::jsonb,
          updated_at = now()
      where id = $1
      `,
      [id, input.status, JSON.stringify(input.responsePayload ?? {})],
    );
  }

  async insertSignal(input: SignalRecord & { campaignId: string; datasetId?: string | null }) {
    const twitterUrl = input.twitterUrl ?? extractTwitterProfileUrl(input.metadata, input.url);
    const result = await this.db.query<{ id: string }>(
      `
      insert into signals (
        id,
        campaign_id,
        source,
        source_ref,
        actor_run_id,
        dataset_id,
        url,
        author_name,
        author_title,
        author_company,
        company_domain,
        twitter_url,
        topic,
        content,
        captured_at,
        metadata
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, to_timestamp($15 / 1000.0), $16::jsonb
      )
      on conflict (source, source_ref)
      do update set
        actor_run_id = excluded.actor_run_id,
        dataset_id = excluded.dataset_id,
        url = excluded.url,
        author_name = excluded.author_name,
        author_title = excluded.author_title,
        author_company = excluded.author_company,
        company_domain = excluded.company_domain,
        twitter_url = excluded.twitter_url,
        topic = excluded.topic,
        content = excluded.content,
        captured_at = excluded.captured_at,
        metadata = excluded.metadata
      returning id
      `,
      [
        input.id,
        input.campaignId,
        input.source,
        input.sourceRef,
        input.actorRunId ?? null,
        input.datasetId ?? null,
        input.url,
        input.authorName,
        input.authorTitle ?? null,
        input.authorCompany ?? null,
        normalizeDomain(input.companyDomain),
        twitterUrl,
        input.topic,
        input.content,
        input.capturedAt,
        JSON.stringify(input.metadata),
      ],
    );

    return result.rows[0]?.id ?? input.id;
  }

  async getSignal(signalId: string): Promise<SignalRecord & { campaignId: string } | null> {
    const result = await this.db.query<SignalRow & { campaign_id: string }>(
      `
      select *
      from signals
      where id = $1
      `,
      [signalId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      campaignId: row.campaign_id,
      source: row.source as SignalRecord["source"],
      sourceRef: row.source_ref,
      actorRunId: row.actor_run_id,
      url: row.url,
      authorName: row.author_name,
      authorTitle: row.author_title,
      authorCompany: row.author_company,
      companyDomain: row.company_domain,
      twitterUrl: row.twitter_url,
      topic: row.topic,
      content: row.content,
      capturedAt: row.captured_at.getTime(),
      metadata: coerceJson(row.metadata, {}),
    };
  }

  async createOrUpdateProspectFromSignal(signalId: string, campaignId: string) {
    const signal = await this.getSignal(signalId);
    if (!signal) {
      throw new Error(`signal ${signalId} not found`);
    }

    const companyDomain = normalizeDomain(signal.companyDomain);
    let accountId: string | null = null;

    if (companyDomain) {
      const existingAccount = await this.db.query(
        `select id from accounts where domain = $1`,
        [companyDomain],
      );
      accountId = existingAccount.rows[0]?.id ?? null;

      if (!accountId) {
        accountId = createId("acct");
        await this.db.query(
          `
          insert into accounts (id, domain, name, metadata, created_at, updated_at)
          values ($1, $2, $3, $4::jsonb, now(), now())
          `,
          [accountId, companyDomain, signal.authorCompany ?? signal.companyDomain ?? "Unknown", JSON.stringify({})],
        );
      }
    }

    const existingBySignal = await this.db.query(
      `
      select id
      from prospects
      where source_signal_id = $1
      limit 1
      `,
      [signalId],
    );

    const linkedinProfileUrl = extractLinkedinProfileUrl(signal.metadata, signal.url);
    const twitterProfileUrl = signal.twitterUrl ?? extractTwitterProfileUrl(signal.metadata, signal.url);
    let existingProspect = existingBySignal;
    if (!existingProspect.rows[0] && linkedinProfileUrl) {
      existingProspect = await this.db.query(
        `
        select id
        from prospects
        where campaign_id = $1
          and linkedin_url = $2
        limit 1
        `,
        [campaignId, linkedinProfileUrl],
      );
    }
    if (!existingProspect.rows[0] && twitterProfileUrl) {
      existingProspect = await this.db.query(
        `
        select id
        from prospects
        where campaign_id = $1
          and twitter_url = $2
        limit 1
        `,
        [campaignId, twitterProfileUrl],
      );
    }
    if (!existingProspect.rows[0]) {
      existingProspect = await this.db.query(
        `
        select id
        from prospects
        where campaign_id = $1
          and full_name = $2
          and coalesce(company_domain, '') = coalesce($3, '')
        limit 1
        `,
        [campaignId, signal.authorName, companyDomain],
      );
    }

    const firstName = signal.authorName.split(/\s+/)[0] ?? signal.authorName;
    const prospectId = existingProspect.rows[0]?.id ?? createId("pros");
    const companyResearchUrl = extractCompanyResearchUrl({
      metadata: signal.metadata,
      companyDomain,
    });

    await this.db.query(
      `
      insert into prospects (
        id,
        campaign_id,
        account_id,
        full_name,
        first_name,
        title,
        company,
        company_domain,
        linkedin_url,
        twitter_url,
        source_signal_id,
        stage,
        status,
        metadata,
        created_at,
        updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'capture_signal', 'active', $12::jsonb, now(), now()
      )
      on conflict (id)
      do update set
        account_id = excluded.account_id,
        title = excluded.title,
        company = excluded.company,
        company_domain = excluded.company_domain,
        linkedin_url = excluded.linkedin_url,
        twitter_url = excluded.twitter_url,
        source_signal_id = excluded.source_signal_id,
        updated_at = now()
      `,
      [
        prospectId,
        campaignId,
        accountId,
        signal.authorName,
        firstName,
        signal.authorTitle ?? null,
        signal.authorCompany ?? null,
        companyDomain,
        linkedinProfileUrl,
        twitterProfileUrl,
        signal.id,
        JSON.stringify({
          signalTopic: signal.topic,
          companyResearchUrl,
        }),
      ],
    );

    const existingThread = await this.db.query(
      `select id from threads where prospect_id = $1 limit 1`,
      [prospectId],
    );
    const threadId = existingThread.rows[0]?.id ?? createId("thr");

    await this.db.query(
      `
      insert into threads (
        id,
        prospect_id,
        campaign_id,
        stage,
        status,
        metadata,
        created_at,
        updated_at
      )
      values ($1, $2, $3, 'capture_signal', 'active', $4::jsonb, now(), now())
      on conflict (id)
      do update set updated_at = now()
      `,
      [threadId, prospectId, campaignId, JSON.stringify({})],
    );

    return { prospectId, threadId };
  }

  async getProspectSnapshot(prospectId: string): Promise<ProspectSnapshot> {
    const result = await this.db.query(
      `
      select
        p.id as prospect_id,
        p.account_id,
        p.campaign_id,
        p.full_name,
        p.first_name,
        p.title,
        p.company,
        p.company_domain,
        p.linkedin_url,
        p.twitter_url,
        p.attio_company_record_id,
        p.attio_person_record_id,
        p.attio_list_entry_id,
        p.source_signal_id,
        p.qualification_reason,
        p.metadata->'qualification' as qualification,
        p.status as prospect_status,
        p.stage as prospect_stage,
        p.last_reply_class as prospect_last_reply_class,
        p.paused_reason as prospect_paused_reason,
        t.id as thread_id,
        t.stage as thread_stage,
        t.status as thread_status,
        t.last_reply_class as thread_last_reply_class,
        t.paused_reason as thread_paused_reason,
        t.next_follow_up_at,
        t.provider_thread_id,
        t.provider_inbox_id,
        c.id as campaign_id,
        c.name as campaign_name,
        c.status as campaign_status,
        c.timezone as campaign_timezone,
        c.quiet_hours_start,
        c.quiet_hours_end,
        c.touch_cap,
        c.email_confidence_threshold,
        c.research_confidence_threshold,
        c.source_linkedin_enabled,
        c.sender_email,
        c.sender_display_name,
        c.sender_provider_inbox_id
      from prospects p
      join threads t on t.prospect_id = p.id
      join campaigns c on c.id = p.campaign_id
      where p.id = $1
      `,
      [prospectId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`prospect ${prospectId} not found`);
    }

    const [email, research, messages] = await Promise.all([
      this.getBestContactEmail(prospectId),
      this.getLatestResearchBrief(prospectId),
      this.listMessages(row.thread_id),
    ]);

    return {
      prospect: {
        prospectId: row.prospect_id,
        accountId: row.account_id,
        campaignId: row.campaign_id,
        fullName: row.full_name,
        firstName: row.first_name,
        title: row.title,
        company: row.company,
        companyDomain: row.company_domain,
        linkedinUrl: row.linkedin_url,
        twitterUrl: row.twitter_url,
        attioCompanyRecordId: row.attio_company_record_id,
        attioPersonRecordId: row.attio_person_record_id,
        attioListEntryId: row.attio_list_entry_id,
        sourceSignalId: row.source_signal_id,
        status: row.prospect_status,
        stage: row.prospect_stage,
        lastReplyClass: row.prospect_last_reply_class,
        pausedReason: row.prospect_paused_reason,
      },
      qualificationReason: row.qualification_reason,
      qualification: coerceQualification(row.qualification),
      campaign: {
        id: row.campaign_id,
        name: row.campaign_name,
        status: row.campaign_status,
        timezone: row.campaign_timezone,
        quietHoursStart: row.quiet_hours_start,
        quietHoursEnd: row.quiet_hours_end,
        touchCap: row.touch_cap,
        emailConfidenceThreshold: Number(row.email_confidence_threshold),
        researchConfidenceThreshold: Number(row.research_confidence_threshold),
        sourceLinkedinEnabled: Boolean(row.source_linkedin_enabled),
        senderEmail: row.sender_email,
        senderDisplayName: row.sender_display_name,
        senderProviderInboxId: row.sender_provider_inbox_id,
      },
      thread: {
        id: row.thread_id,
        stage: row.thread_stage,
        status: row.thread_status,
        lastReplyClass: row.thread_last_reply_class,
        pausedReason: row.thread_paused_reason,
        nextFollowUpAt: row.next_follow_up_at?.toISOString?.() ?? null,
        providerThreadId: row.provider_thread_id,
        providerInboxId: row.provider_inbox_id,
      },
      email,
      researchBrief: research,
      messages,
    };
  }

  async getProspectIdByProviderThreadId(providerThreadId: string) {
    const result = await this.db.query(
      `
      select prospect_id, id
      from threads
      where provider_thread_id = $1
      limit 1
      `,
      [providerThreadId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return { prospectId: row.prospect_id as string, threadId: row.id as string };
  }

  async getBestContactEmail(prospectId: string): Promise<ContactEmail | null> {
    const result = await this.db.query(
      `
      select value, confidence, source
      from contact_methods
      where prospect_id = $1 and kind = 'email'
      order by confidence desc, updated_at desc
      limit 1
      `,
      [prospectId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      address: row.value,
      confidence: Number(row.confidence),
      source: row.source,
    };
  }

  async upsertContactEmail(prospectId: string, email: ContactEmail) {
    const existing = await this.db.query(
      `
      select id
      from contact_methods
      where prospect_id = $1 and kind = 'email' and value = $2
      limit 1
      `,
      [prospectId, email.address],
    );

    const id = existing.rows[0]?.id ?? createId("cm");

    await this.db.query(
      `
      insert into contact_methods (
        id, prospect_id, kind, value, confidence, source, verified, metadata, created_at, updated_at
      )
      values ($1, $2, 'email', $3, $4, $5, $6, $7::jsonb, now(), now())
      on conflict (id)
      do update set
        confidence = excluded.confidence,
        source = excluded.source,
        verified = excluded.verified,
        updated_at = now()
      `,
      [id, prospectId, email.address, email.confidence, email.source, email.confidence >= 0.75, JSON.stringify({})],
    );
  }

  async saveResearchBrief(input: Omit<ResearchBrief, "id" | "createdAt"> & { metadata?: Record<string, unknown> }) {
    const id = createId("brief");
    const metadata = {
      ...(input.metadata ?? {}),
      copyGuidance: input.copyGuidance ?? null,
    };
    await this.db.query(
      `
      insert into research_briefs (
        id, prospect_id, campaign_id, summary, evidence, confidence, metadata, created_at
      )
      values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, now())
      `,
      [
        id,
        input.prospectId,
        input.campaignId,
        input.summary,
        JSON.stringify(input.evidence),
        input.confidence,
        JSON.stringify(metadata),
      ],
    );

    return id;
  }

  async getLatestResearchBrief(prospectId: string): Promise<ResearchBrief | null> {
    const result = await this.db.query(
      `
      select id, prospect_id, campaign_id, summary, evidence, confidence, metadata, created_at
      from research_briefs
      where prospect_id = $1
      order by created_at desc
      limit 1
      `,
      [prospectId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      prospectId: row.prospect_id,
      campaignId: row.campaign_id,
      summary: row.summary,
      copyGuidance:
        row.metadata && typeof row.metadata === "object" && row.metadata.copyGuidance
          ? row.metadata.copyGuidance
          : null,
      evidence: Array.isArray(row.evidence) ? row.evidence : [],
      confidence: Number(row.confidence),
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async listMessages(threadId: string): Promise<ProspectSnapshot["messages"]> {
    const result = await this.db.query(
      `
      select id, direction, kind, subject, body_text, classification, created_at
      from messages
      where thread_id = $1
      order by created_at asc
      `,
      [threadId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      kind: row.kind,
      subject: row.subject,
      bodyText: row.body_text,
      classification: row.classification,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async addMessage(input: MessageInsertInput) {
    const id = createId("msg");
    await this.db.query(
      `
      insert into messages (
        id,
        thread_id,
        provider_message_id,
        direction,
        kind,
        subject,
        body_text,
        body_html,
        classification,
        metadata,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
      `,
      [
        id,
        input.threadId,
        input.providerMessageId ?? null,
        input.direction,
        input.kind,
        input.subject ?? null,
        input.bodyText,
        input.bodyHtml ?? null,
        input.classification ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return id;
  }

  async updateThreadState(input: {
    threadId: string;
    stage?: LifecycleStage;
    status?: ThreadStatus;
    lastReplyClass?: ReplyClass | null;
    pausedReason?: string | null;
    providerThreadId?: string | null;
    providerInboxId?: string | null;
    nextFollowUpAt?: string | null;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [input.threadId];
    let index = 2;

    if (input.stage) {
      fields.push(`stage = $${index++}`);
      values.push(input.stage);
    }
    if (input.status) {
      fields.push(`status = $${index++}`);
      values.push(input.status);
    }
    if (input.lastReplyClass !== undefined) {
      fields.push(`last_reply_class = $${index++}`);
      values.push(input.lastReplyClass);
    }
    if (input.pausedReason !== undefined) {
      fields.push(`paused_reason = $${index++}`);
      values.push(input.pausedReason);
    }
    if (input.providerThreadId !== undefined) {
      fields.push(`provider_thread_id = $${index++}`);
      values.push(input.providerThreadId);
    }
    if (input.providerInboxId !== undefined) {
      fields.push(`provider_inbox_id = $${index++}`);
      values.push(input.providerInboxId);
    }
    if (input.nextFollowUpAt !== undefined) {
      fields.push(`next_follow_up_at = $${index++}`);
      values.push(input.nextFollowUpAt);
    }

    fields.push(`updated_at = now()`);

    await this.db.query(
      `
      update threads
      set ${fields.join(", ")}
      where id = $1
      `,
      values,
    );
  }

  async updateProspectState(input: {
    prospectId: string;
    stage?: LifecycleStage;
    status?: ThreadStatus;
    lastReplyClass?: ReplyClass | null;
    pausedReason?: string | null;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [input.prospectId];
    let index = 2;

    if (input.stage) {
      fields.push(`stage = $${index++}`);
      values.push(input.stage);
    }
    if (input.status) {
      fields.push(`status = $${index++}`);
      values.push(input.status);
    }
    if (input.lastReplyClass !== undefined) {
      fields.push(`last_reply_class = $${index++}`);
      values.push(input.lastReplyClass);
    }
    if (input.pausedReason !== undefined) {
      fields.push(`paused_reason = $${index++}`);
      values.push(input.pausedReason);
    }

    fields.push(`updated_at = now()`);

    await this.db.query(
      `
      update prospects
      set ${fields.join(", ")}
      where id = $1
      `,
      values,
    );
  }

  async updateProspectCrmReferences(input: {
    prospectId: string;
    attioCompanyRecordId?: string | null;
    attioPersonRecordId?: string | null;
    attioListEntryId?: string | null;
  }) {
    const fields: string[] = [];
    const values: unknown[] = [input.prospectId];
    let index = 2;

    if (input.attioCompanyRecordId !== undefined) {
      fields.push(`attio_company_record_id = $${index++}`);
      values.push(input.attioCompanyRecordId);
    }
    if (input.attioPersonRecordId !== undefined) {
      fields.push(`attio_person_record_id = $${index++}`);
      values.push(input.attioPersonRecordId);
    }
    if (input.attioListEntryId !== undefined) {
      fields.push(`attio_list_entry_id = $${index++}`);
      values.push(input.attioListEntryId);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push(`updated_at = now()`);

    await this.db.query(
      `
      update prospects
      set ${fields.join(", ")}
      where id = $1
      `,
      values,
    );
  }

  async applyQualificationAssessment(prospectId: string, assessment: QualificationAssessment) {
    await this.db.query(
      `
      update prospects
      set is_qualified = $2,
          qualified_at = case
            when $2 then coalesce(qualified_at, now())
            else null
          end,
          qualification_reason = $3,
          metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{qualification}', $4::jsonb, true),
          updated_at = now()
      where id = $1
      `,
      [prospectId, assessment.ok, assessment.reason, JSON.stringify(assessment)],
    );
  }

  async pauseThread(threadId: string, reason: string) {
    await this.updateThreadState({
      threadId,
      status: "paused",
      pausedReason: reason,
    });

    const result = await this.db.query(`select prospect_id from threads where id = $1`, [threadId]);
    const prospectId = result.rows[0]?.prospect_id as string | undefined;
    if (prospectId) {
      await this.updateProspectState({
        prospectId,
        status: "paused",
        pausedReason: reason,
      });
    }
  }

  async createHandoff(threadId: string, target: string, payload: Record<string, unknown>) {
    const id = createId("handoff");
    await this.db.query(
      `
      insert into handoffs (id, thread_id, target, payload, status, created_at, updated_at)
      values ($1, $2, $3, $4::jsonb, 'queued', now(), now())
      `,
      [id, threadId, target, JSON.stringify(payload)],
    );
    return id;
  }

  async markHandoffStatus(handoffId: string, status: string) {
    await this.db.query(
      `
      update handoffs
      set status = $2, updated_at = now()
      where id = $1
      `,
      [handoffId, status],
    );
  }

  async appendAuditEvent(
    entityType: string,
    entityId: string,
    eventName: InternalEventName | string,
    payload: Record<string, unknown>,
  ) {
    await this.db.query(
      `
      insert into audit_events (id, entity_type, entity_id, event_name, payload, created_at)
      values ($1, $2, $3, $4, $5::jsonb, now())
      `,
      [createId("audit"), entityType, entityId, eventName, JSON.stringify(payload)],
    );
  }

  async countOutboundMessages(threadId: string) {
    const result = await this.db.query(
      `
      select count(*)::int as count
      from messages
      where thread_id = $1 and direction = 'outbound'
      `,
      [threadId],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  async getLatestInboundMessage(threadId: string) {
    const result = await this.db.query(
      `
      select id, subject, body_text, provider_message_id, created_at
      from messages
      where thread_id = $1 and direction = 'inbound'
      order by created_at desc
      limit 1
      `,
      [threadId],
    );
    return result.rows[0] ?? null;
  }

  async getThread(threadId: string) {
    const result = await this.db.query(
      `
      select id, prospect_id, campaign_id, stage, status, last_reply_class, paused_reason, provider_thread_id
      , provider_inbox_id
      from threads
      where id = $1
      `,
      [threadId],
    );
    return result.rows[0] ?? null;
  }

  async touchThreadFollowup(threadId: string, dateIso: string | null) {
    await this.updateThreadState({ threadId, nextFollowUpAt: dateIso });
  }

  async saveSandboxTranscript(input: {
    threadId: string;
    stage: LifecycleStage;
    transcript: unknown[];
    outputText: string;
    usage?: Record<string, unknown>;
  }) {
    await this.appendAuditEvent("thread", input.threadId, "SandboxTurnCompleted", {
      stage: input.stage,
      transcript: input.transcript,
      outputText: input.outputText,
      usage: input.usage ?? {},
      storedAt: nowIso(),
    });
  }

  async getCampaignPolicyForProspect(prospectId: string) {
    const result = await this.db.query(
      `
      select c.*
      from campaigns c
      join prospects p on p.campaign_id = c.id
      where p.id = $1
      `,
      [prospectId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`campaign for prospect ${prospectId} not found`);
    }
    return this.getCampaign(row.id);
  }
}

export type TrellisRepositoryPort = Pick<
  TrellisRepository,
  | "ensureDefaultCampaign"
  | "getCampaign"
  | "getControlFlags"
  | "setControlFlag"
  | "setCampaignLinkedinSource"
  | "setCampaignTimezone"
  | "updateCampaignSenderIdentity"
  | "getDashboardSummary"
  | "listRecentSignals"
  | "listRecentProspects"
  | "getProspectDashboardRow"
  | "listQualifiedLeads"
  | "listActiveThreads"
  | "listRecentProviderRuns"
  | "listRecentAuditEvents"
  | "listAuditEventsForEntity"
  | "recordProviderRun"
  | "updateProviderRun"
  | "insertSignal"
  | "getSignal"
  | "createOrUpdateProspectFromSignal"
  | "getProspectSnapshot"
  | "getProspectIdByProviderThreadId"
  | "getBestContactEmail"
  | "upsertContactEmail"
  | "saveResearchBrief"
  | "getLatestResearchBrief"
  | "listMessages"
  | "addMessage"
  | "updateThreadState"
  | "updateProspectState"
  | "updateProspectCrmReferences"
  | "applyQualificationAssessment"
  | "pauseThread"
  | "createHandoff"
  | "markHandoffStatus"
  | "appendAuditEvent"
  | "countOutboundMessages"
  | "getLatestInboundMessage"
  | "getThread"
  | "touchThreadFollowup"
  | "saveSandboxTranscript"
  | "getCampaignPolicyForProspect"
>;
