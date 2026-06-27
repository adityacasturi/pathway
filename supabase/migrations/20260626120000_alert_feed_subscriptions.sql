-- Feed alerts (morning briefing, nightly briefing) as first-class subscriptions.

alter table public.alert_subscriptions
  drop constraint if exists alert_subscriptions_target_type_check;

alter table public.alert_subscriptions
  add constraint alert_subscriptions_target_type_check
  check (target_type in ('company', 'industry', 'sector', 'feed'));

create or replace function app_private.validate_alert_subscription_row()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.target_type = 'feed' then
    if new.cadence is distinct from 'digest' then
      raise exception 'invalid_alert_subscription_cadence'
        using errcode = 'check_violation';
    end if;

    if new.target_id not in ('morning-briefing', 'nightly-briefing') then
      raise exception 'invalid_alert_feed'
        using errcode = 'check_violation';
    end if;
  elsif new.target_type = 'sector' then
    if new.cadence is distinct from 'instant' then
      raise exception 'invalid_alert_subscription_cadence'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1 from public.alert_curated_sectors s where s.slug = new.target_id
    ) then
      raise exception 'invalid_alert_sector'
        using errcode = 'check_violation';
    end if;
  elsif new.target_type = 'company' then
    if new.cadence is distinct from 'instant' then
      raise exception 'invalid_alert_subscription_cadence'
        using errcode = 'check_violation';
    end if;

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
  else
    raise exception 'invalid_alert_target_type'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function app_private.validate_alert_subscription_row() from public, anon, authenticated;

insert into public.alert_subscriptions (user_id, target_type, target_id, cadence, filter_override, paused)
select
  p.user_id,
  'feed',
  'morning-briefing',
  'digest',
  null,
  false
from public.alert_preferences p
where p.digest_enabled = true
on conflict (user_id, target_type, target_id) do nothing;
