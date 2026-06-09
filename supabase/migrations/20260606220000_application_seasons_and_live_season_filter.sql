-- Allow all four application seasons in RPC + table constraint.
-- Widen live_season_filter to accept comma-separated multi-select values.

create or replace function app_private.live_season_filter_valid(p_filter text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_filter = 'all'
    or (
      p_filter ~ '^(Summer|Fall|Spring|Winter)(,(Summer|Fall|Spring|Winter))*$'
      and cardinality(string_to_array(p_filter, ',')) between 1 and 4
    );
$$;

alter table public.applications
  drop constraint if exists applications_season_check;

alter table public.applications
  add constraint applications_season_check
  check (
    season is null
    or season in ('Summer', 'Fall', 'Spring', 'Winter')
  );

alter table public.user_preferences
  drop constraint if exists user_preferences_live_season_filter_check;

alter table public.user_preferences
  add constraint user_preferences_live_season_filter_check
  check (app_private.live_season_filter_valid(live_season_filter));

create or replace function public.create_application_with_event(
  p_company text,
  p_role text,
  p_posting_url text,
  p_location text,
  p_season text,
  p_date_applied date
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_application_id uuid;
  v_event jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_company is null or p_company <> btrim(p_company) or char_length(p_company) not between 1 and 120 then
    raise exception 'Invalid company';
  end if;

  if p_role is null or p_role <> btrim(p_role) or char_length(p_role) not between 1 and 160 then
    raise exception 'Invalid role';
  end if;

  if p_location is not null and (p_location <> btrim(p_location) or char_length(p_location) not between 1 and 240) then
    raise exception 'Invalid location';
  end if;

  if p_season is not null and p_season not in ('Summer', 'Fall', 'Spring', 'Winter') then
    raise exception 'Invalid season';
  end if;

  insert into public.applications (
    user_id,
    company,
    role,
    posting_url,
    location,
    season,
    status
  )
  values (
    v_user_id,
    p_company,
    p_role,
    p_posting_url,
    p_location,
    p_season,
    'applied'
  )
  returning id into v_application_id;

  insert into public.application_events (
    application_id,
    user_id,
    event_type,
    event_date
  )
  values (
    v_application_id,
    v_user_id,
    'applied',
    coalesce(p_date_applied, current_date)
  )
  returning to_jsonb(application_events.*) into v_event;

  return jsonb_build_object('id', v_application_id, 'appliedEvent', v_event);
end;
$function$;
