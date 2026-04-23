create table if not exists campaigns (
  id text primary key,
  name text not null,
  status text not null default 'active',
  quiet_hours_start integer not null default 21,
  quiet_hours_end integer not null default 8,
  touch_cap integer not null default 5,
  email_confidence_threshold real not null default 0.75,
  research_confidence_threshold real not null default 0.65,
  source_linkedin_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists accounts (
  id text primary key,
  domain text unique,
  name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prospects (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  account_id text references accounts(id) on delete set null,
  full_name text not null,
  first_name text not null,
  title text,
  company text,
  company_domain text,
  linkedin_url text,
  source_signal_id text,
  stage text not null,
  status text not null default 'active',
  last_reply_class text,
  paused_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists signals (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  source text not null,
  source_ref text not null,
  actor_run_id text,
  dataset_id text,
  url text not null,
  author_name text not null,
  author_title text,
  author_company text,
  company_domain text,
  topic text not null,
  content text not null,
  captured_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source, source_ref)
);

create table if not exists contact_methods (
  id text primary key,
  prospect_id text not null references prospects(id) on delete cascade,
  kind text not null,
  value text not null,
  confidence real not null default 0,
  source text not null,
  verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists research_briefs (
  id text primary key,
  prospect_id text not null references prospects(id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence real not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists threads (
  id text primary key,
  prospect_id text not null references prospects(id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  stage text not null,
  status text not null default 'active',
  last_reply_class text,
  paused_reason text,
  next_follow_up_at timestamptz,
  provider_thread_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id text primary key,
  thread_id text not null references threads(id) on delete cascade,
  provider_message_id text,
  direction text not null,
  kind text not null,
  subject text,
  body_text text not null,
  body_html text,
  classification text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists handoffs (
  id text primary key,
  thread_id text not null references threads(id) on delete cascade,
  target text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists provider_runs (
  id text primary key,
  provider text not null,
  kind text not null,
  external_id text,
  status text not null,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists control_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_signals_campaign_id on signals(campaign_id);
create index if not exists idx_prospects_campaign_id on prospects(campaign_id);
create index if not exists idx_threads_prospect_id on threads(prospect_id);
create index if not exists idx_messages_thread_id on messages(thread_id);
