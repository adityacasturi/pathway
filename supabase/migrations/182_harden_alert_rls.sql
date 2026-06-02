-- Harden alert subscriptions: DB validation, curated sector catalog, RLS perf fix.

create table if not exists public.alert_curated_sectors (
  slug text primary key,
  constraint alert_curated_sectors_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

insert into public.alert_curated_sectors (slug)
values
  ('faang'),
  ('ai-stack'),
  ('quant'),
  ('semis'),
  ('wall-street'),
  ('autonomous'),
  ('defense'),
  ('unicorns'),
  ('cybersecurity')
on conflict (slug) do nothing;

alter table public.alert_curated_sectors enable row level security;

create policy "Anyone can read curated sectors"
  on public.alert_curated_sectors for select
  using (true);

create or replace function app_private.validate_alert_subscription_row()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.cadence is distinct from 'instant' then
    raise exception 'invalid_alert_subscription_cadence'
      using errcode = 'check_violation';
  end if;

  if new.target_type = 'sector' then
    if not exists (
      select 1 from public.alert_curated_sectors s where s.slug = new.target_id
    ) then
      raise exception 'invalid_alert_sector'
        using errcode = 'check_violation';
    end if;
  elsif new.target_type = 'company' then
    if new.target_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'invalid_alert_company_id'
        using errcode = 'check_violation';
    end if;
    if not exists (
      select 1
      from public.companies c
      where c.id = new.target_id::uuid
        and c.is_active = true
    ) then
      raise exception 'invalid_alert_company'
        using errcode = 'check_violation';
    end if;
  elsif new.target_type = 'industry' then
    if not exists (
      select 1 from public.discover_industries i where i.slug = new.target_id
    ) then
      raise exception 'invalid_alert_industry'
        using errcode = 'check_violation';
    end if;
  else
    raise exception 'invalid_alert_target_type'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function app_private.validate_alert_subscription_row() from public, anon, authenticated;

drop trigger if exists alert_subscriptions_validate on public.alert_subscriptions;

create trigger alert_subscriptions_validate
  before insert or update on public.alert_subscriptions
  for each row
  execute function app_private.validate_alert_subscription_row();

-- RLS: evaluate auth.uid() once per statement (Supabase advisor).
drop policy if exists "Users manage own alert preferences" on public.alert_preferences;
create policy "Users manage own alert preferences"
  on public.alert_preferences for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own alert subscriptions" on public.alert_subscriptions;
create policy "Users manage own alert subscriptions"
  on public.alert_subscriptions for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read own sent postings" on public.alert_sent_postings;
create policy "Users read own sent postings"
  on public.alert_sent_postings for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own digest state" on public.alert_digest_state;
create policy "Users read own digest state"
  on public.alert_digest_state for select
  using ((select auth.uid()) = user_id);
