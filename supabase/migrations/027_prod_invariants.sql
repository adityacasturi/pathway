-- Migration 027: production invariants for direct Supabase access.
--
-- Server Actions validate these rules too, but authenticated users can call
-- the Supabase REST API directly with the anon key. Keep critical ownership,
-- shape, and rate-limit rules at the database layer.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_company_shape_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_company_shape_check
      check (company = btrim(company) and char_length(company) between 1 and 120)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_role_shape_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_role_shape_check
      check (role = btrim(role) and char_length(role) between 1 and 160)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_location_shape_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_location_shape_check
      check (
        location is null
        or (location = btrim(location) and char_length(location) between 1 and 240)
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_posting_url_shape_check'
      and conrelid = 'public.applications'::regclass
  ) then
    alter table public.applications
      add constraint applications_posting_url_shape_check
      check (
        posting_url is null
        or (
          char_length(posting_url) <= 2048
          and posting_url ~* '^https?://[^[:space:]]+$'
          and posting_url !~* '^https?://([^/@]+@)?(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'application_events_notes_length_check'
      and conrelid = 'public.application_events'::regclass
  ) then
    alter table public.application_events
      add constraint application_events_notes_length_check
      check (notes is null or char_length(notes) <= 2000)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'application_events_round_number_check'
      and conrelid = 'public.application_events'::regclass
  ) then
    alter table public.application_events
      add constraint application_events_round_number_check
      check (
        (event_type = 'interview' and round_number is not null and round_number > 0)
        or (event_type <> 'interview' and round_number is null)
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'application_events_deadline_completion_check'
      and conrelid = 'public.application_events'::regclass
  ) then
    alter table public.application_events
      add constraint application_events_deadline_completion_check
      check (deadline_completed_at is null or deadline_date is not null)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'feed_interactions_posting_id_shape_check'
      and conrelid = 'public.feed_interactions'::regclass
  ) then
    alter table public.feed_interactions
      add constraint feed_interactions_posting_id_shape_check
      check (posting_id = btrim(posting_id) and char_length(posting_id) between 1 and 300)
      not valid;
  end if;
end $$;

create or replace function public.enforce_event_application_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select a.user_id
  into v_owner
  from public.applications a
  where a.id = new.application_id;

  if v_owner is null then
    raise exception 'Application not found';
  end if;

  if new.user_id is distinct from v_owner then
    raise exception 'Event user must match application owner';
  end if;

  if auth.uid() is not null and auth.uid() is distinct from new.user_id then
    raise exception 'Not authenticated';
  end if;

  return new;
end;
$$;

drop trigger if exists application_events_owner_guard on public.application_events;
create trigger application_events_owner_guard
  before insert or update on public.application_events
  for each row execute function public.enforce_event_application_owner();

drop trigger if exists application_events_keep_applied on public.application_events;
drop function if exists public.prevent_applied_event_delete();

drop policy if exists "users can delete own events" on public.application_events;
create policy "users can delete own events"
  on public.application_events for delete
  using (
    auth.uid() = user_id
    and event_type <> 'applied'
    and exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and a.user_id = auth.uid()
    )
  );

create or replace function public.enforce_user_preferences_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    new.updated_at := now();
    perform public.enforce_rate_limit(v_user_id::text, 'user_preferences:write', 60, 600);
    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists user_preferences_rate_limit on public.user_preferences;
create trigger user_preferences_rate_limit
  before insert or update on public.user_preferences
  for each row execute function public.enforce_user_preferences_write_rate_limit();

do $$
begin
  if not exists (
    select 1
    from public.application_events
    where event_type = 'applied'
    group by application_id
    having count(*) > 1
  ) then
    execute 'create unique index if not exists application_events_one_applied_per_application_idx
      on public.application_events (application_id)
      where event_type = ''applied''';
  else
    raise notice 'Skipped applied-event unique index because duplicate applied events exist.';
  end if;

  if not exists (
    select 1
    from public.application_events
    where event_type = 'interview'
    group by application_id, round_number
    having count(*) > 1
  ) then
    execute 'create unique index if not exists application_events_unique_interview_round_idx
      on public.application_events (application_id, round_number)
      where event_type = ''interview''';
  else
    raise notice 'Skipped interview-round unique index because duplicate rounds exist.';
  end if;
end $$;
