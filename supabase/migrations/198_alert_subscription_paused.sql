-- Allow pausing individual alert subscriptions without deleting them.

alter table public.alert_subscriptions
  add column if not exists paused boolean not null default false;

comment on column public.alert_subscriptions.paused is
  'When true, the subscription is kept but excluded from instant and digest matching.';
