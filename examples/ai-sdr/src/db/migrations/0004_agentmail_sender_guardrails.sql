alter table campaigns
  add column if not exists sender_email text,
  add column if not exists sender_display_name text,
  add column if not exists sender_provider_inbox_id text;

alter table threads
  add column if not exists provider_inbox_id text;
