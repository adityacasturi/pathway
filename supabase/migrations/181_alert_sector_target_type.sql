-- Allow curated sector subscriptions (FAANG, AI labs, etc.)
alter table public.alert_subscriptions
  drop constraint if exists alert_subscriptions_target_type_check;

alter table public.alert_subscriptions
  add constraint alert_subscriptions_target_type_check
  check (target_type in ('company', 'industry', 'sector'));
