alter table campaigns
  add column if not exists timezone text not null default 'UTC';
