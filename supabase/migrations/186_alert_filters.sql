-- Global and per-subscription alert filters (season, country, remote).

alter table public.alert_preferences
  add column if not exists alert_seasons text[],
  add column if not exists alert_countries text[],
  add column if not exists alert_include_remote boolean not null default true;

alter table public.alert_subscriptions
  add column if not exists filter_override jsonb;

create or replace function app_private.alert_seasons_valid(p_seasons text[])
returns boolean
language sql
immutable
as $$
  select p_seasons is null
    or cardinality(p_seasons) = 0
    or (
      cardinality(p_seasons) <= 4
      and not exists (
        select 1
        from unnest(p_seasons) s
        where s not in ('Summer', 'Fall', 'Spring', 'Winter')
      )
    );
$$;

create or replace function app_private.alert_countries_valid(p_countries text[])
returns boolean
language sql
immutable
as $$
  select p_countries is null
    or cardinality(p_countries) = 0
    or (
      cardinality(p_countries) <= 32
      and not exists (
        select 1
        from unnest(p_countries) c
        where c not in (
          'US', 'CA', 'GB', 'IE', 'DE', 'FR', 'NL', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL',
          'ES', 'IT', 'PT', 'BE', 'AT', 'IL', 'IN', 'CN', 'HK', 'TW', 'JP', 'KR', 'SG',
          'AU', 'NZ', 'MX', 'BR', 'AE'
        )
      )
    );
$$;

create or replace function app_private.alert_filter_override_valid(p_override jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_seasons text[];
  v_countries text[];
  v_include_remote boolean;
begin
  if p_override is null then
    return true;
  end if;

  if jsonb_typeof(p_override) <> 'object' then
    return false;
  end if;

  if p_override ? 'seasons' then
    if jsonb_typeof(p_override -> 'seasons') <> 'array' then
      return false;
    end if;
    select coalesce(array_agg(value #>> '{}'), '{}')
    into v_seasons
    from jsonb_array_elements(p_override -> 'seasons');
    if not app_private.alert_seasons_valid(v_seasons) then
      return false;
    end if;
  end if;

  if p_override ? 'countries' then
    if jsonb_typeof(p_override -> 'countries') <> 'array' then
      return false;
    end if;
    select coalesce(array_agg(upper(value #>> '{}')), '{}')
    into v_countries
    from jsonb_array_elements(p_override -> 'countries');
    if not app_private.alert_countries_valid(v_countries) then
      return false;
    end if;
  end if;

  if p_override ? 'include_remote' then
    if jsonb_typeof(p_override -> 'include_remote') <> 'boolean' then
      return false;
    end if;
    v_include_remote := (p_override ->> 'include_remote')::boolean;
    if v_include_remote is null then
      return false;
    end if;
  end if;

  if p_override ? 'includeRemote' then
    return false;
  end if;

  return true;
end;
$$;

alter table public.alert_preferences
  drop constraint if exists alert_preferences_seasons_valid;

alter table public.alert_preferences
  add constraint alert_preferences_seasons_valid
  check (app_private.alert_seasons_valid(alert_seasons));

alter table public.alert_preferences
  drop constraint if exists alert_preferences_countries_valid;

alter table public.alert_preferences
  add constraint alert_preferences_countries_valid
  check (app_private.alert_countries_valid(alert_countries));

alter table public.alert_subscriptions
  drop constraint if exists alert_subscriptions_filter_override_valid;

alter table public.alert_subscriptions
  add constraint alert_subscriptions_filter_override_valid
  check (app_private.alert_filter_override_valid(filter_override));

create or replace function public.set_alert_global_filters(
  p_seasons text[],
  p_countries text[],
  p_include_remote boolean
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not app_private.alert_seasons_valid(p_seasons) then
    raise exception 'invalid_alert_seasons' using errcode = '22023';
  end if;

  if not app_private.alert_countries_valid(p_countries) then
    raise exception 'invalid_alert_countries' using errcode = '22023';
  end if;

  if p_include_remote is null then
    raise exception 'invalid_include_remote' using errcode = '22023';
  end if;

  insert into public.alert_preferences (
    user_id,
    alert_seasons,
    alert_countries,
    alert_include_remote,
    updated_at
  )
  values (
    auth.uid(),
    case when p_seasons is null or cardinality(p_seasons) = 0 then null else p_seasons end,
    case when p_countries is null or cardinality(p_countries) = 0 then null else p_countries end,
    p_include_remote,
    now()
  )
  on conflict (user_id) do update
  set alert_seasons = excluded.alert_seasons,
      alert_countries = excluded.alert_countries,
      alert_include_remote = excluded.alert_include_remote,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.add_alert_sector_subscription(
  p_sector_slug text,
  p_filter_override jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not app_private.alert_filter_override_valid(p_filter_override) then
    raise exception 'invalid_filter_override' using errcode = '22023';
  end if;

  insert into public.alert_subscriptions (user_id, target_type, target_id, cadence, filter_override)
  values (auth.uid(), 'sector', trim(p_sector_slug), 'instant', p_filter_override)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.add_alert_company_subscription(
  p_company_id uuid,
  p_filter_override jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not app_private.alert_filter_override_valid(p_filter_override) then
    raise exception 'invalid_filter_override' using errcode = '22023';
  end if;

  insert into public.alert_subscriptions (user_id, target_type, target_id, cadence, filter_override)
  values (auth.uid(), 'company', p_company_id::text, 'instant', p_filter_override)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_alert_subscription_filters(
  p_subscription_id uuid,
  p_filter_override jsonb
)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if not app_private.alert_filter_override_valid(p_filter_override) then
    raise exception 'invalid_filter_override' using errcode = '22023';
  end if;

  update public.alert_subscriptions
  set filter_override = p_filter_override
  where id = p_subscription_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.set_alert_global_filters(text[], text[], boolean) to authenticated;
grant execute on function public.add_alert_sector_subscription(text, jsonb) to authenticated;
grant execute on function public.add_alert_company_subscription(uuid, jsonb) to authenticated;
grant execute on function public.update_alert_subscription_filters(uuid, jsonb) to authenticated;
