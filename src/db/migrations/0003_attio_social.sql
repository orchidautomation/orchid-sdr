alter table signals
  add column if not exists twitter_url text;

alter table prospects
  add column if not exists twitter_url text;

alter table prospects
  add column if not exists attio_company_record_id text;

alter table prospects
  add column if not exists attio_person_record_id text;

alter table prospects
  add column if not exists attio_list_entry_id text;

create index if not exists idx_signals_twitter_url on signals(twitter_url);
create index if not exists idx_prospects_linkedin_url on prospects(linkedin_url);
create index if not exists idx_prospects_twitter_url on prospects(twitter_url);
create index if not exists idx_prospects_attio_company_record_id on prospects(attio_company_record_id);
create index if not exists idx_prospects_attio_person_record_id on prospects(attio_person_record_id);

drop view if exists qualified_leads;

create view qualified_leads as
with latest_email as (
  select distinct on (cm.prospect_id)
    cm.prospect_id,
    cm.value as email,
    cm.confidence as email_confidence,
    cm.source as email_source,
    cm.verified as email_verified
  from contact_methods cm
  where cm.kind = 'email'
  order by cm.prospect_id, cm.confidence desc, cm.updated_at desc
),
latest_research as (
  select distinct on (rb.prospect_id)
    rb.prospect_id,
    rb.summary as research_summary,
    rb.confidence as research_confidence,
    rb.created_at as research_created_at
  from research_briefs rb
  order by rb.prospect_id, rb.created_at desc
)
select
  p.id as prospect_id,
  p.campaign_id,
  p.account_id,
  p.full_name,
  p.first_name,
  p.title,
  p.company,
  p.company_domain,
  p.linkedin_url,
  p.twitter_url,
  p.source_signal_id,
  p.is_qualified,
  p.qualified_at,
  p.qualification_reason,
  p.stage as prospect_stage,
  p.status as prospect_status,
  p.paused_reason as prospect_paused_reason,
  t.id as thread_id,
  t.stage as thread_stage,
  t.status as thread_status,
  t.paused_reason as thread_paused_reason,
  t.next_follow_up_at,
  le.email,
  le.email_confidence,
  le.email_source,
  le.email_verified,
  lr.research_summary,
  lr.research_confidence,
  s.source as signal_source,
  s.topic as signal_topic,
  s.url as signal_url,
  s.author_name,
  s.author_title,
  s.author_company,
  p.created_at,
  p.updated_at
from prospects p
join threads t on t.prospect_id = p.id
left join latest_email le on le.prospect_id = p.id
left join latest_research lr on lr.prospect_id = p.id
left join signals s on s.id = p.source_signal_id
where p.is_qualified = true;
