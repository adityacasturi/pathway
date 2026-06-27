-- Retire digest alert feeds and disable legacy digest preferences.

delete from public.alert_subscriptions
where target_type = 'feed';

update public.alert_preferences
set digest_enabled = false,
    updated_at = now()
where digest_enabled = true;

drop function if exists public.set_alert_digest_enabled(boolean);

alter table public.alert_subscriptions
  drop constraint if exists alert_subscriptions_target_type_check;

alter table public.alert_subscriptions
  add constraint alert_subscriptions_target_type_check
  check (target_type in ('company', 'industry', 'sector'));

create or replace function app_private.validate_alert_subscription_row()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.target_type = 'sector' then
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
