alter table public.alert_preferences
  add column if not exists digest_enabled boolean not null default false;
