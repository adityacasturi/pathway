-- Migration 030: tighten RPC grants, move privileged helpers out of public,
-- and add transactional write helpers for app/event creation.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

drop policy if exists "rate limits deny select" on public.rate_limits;
drop policy if exists "rate limits deny insert" on public.rate_limits;
drop policy if exists "rate limits deny update" on public.rate_limits;
drop policy if exists "rate limits deny delete" on public.rate_limits;

create policy "rate limits deny select"
  on public.rate_limits for select
  to public
  using (false);

create policy "rate limits deny insert"
  on public.rate_limits for insert
  to public
  with check (false);

create policy "rate limits deny update"
  on public.rate_limits for update
  to public
  using (false)
  with check (false);

create policy "rate limits deny delete"
  on public.rate_limits for delete
  to public
  using (false);

create or replace function app_private.enforce_rate_limit(
  p_subject text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_subject is null or length(trim(p_subject)) = 0 then
    raise exception 'Rate limit subject is required';
  end if;

  if p_bucket is null or length(trim(p_bucket)) = 0 then
    raise exception 'Rate limit bucket is required';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception 'Invalid rate limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit window';
  end if;

  v_window_start :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits (subject, bucket, window_start, count, updated_at)
  values (p_subject, p_bucket, v_window_start, 1, now())
  on conflict (subject, bucket, window_start)
  do update set
    count = public.rate_limits.count + 1,
    updated_at = now()
  returning count into v_count;

  delete from public.rate_limits
  where updated_at < now() - interval '2 days';

  if v_count > p_limit then
    raise exception 'Too many attempts. Please wait a moment and try again.';
  end if;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_limit - v_count, 0),
    'resetAt', v_window_start + make_interval(secs => p_window_seconds)
  );
end;
$$;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not (p_bucket = 'feed:refresh' and p_limit = 10 and p_window_seconds = 600) then
    raise exception 'Invalid rate limit bucket' using errcode = '22023';
  end if;

  return app_private.enforce_rate_limit(v_user_id::text, p_bucket, p_limit, p_window_seconds);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

create or replace function app_private.derive_application_status(
  p_application_id uuid,
  p_user_id uuid
)
returns text
language sql
security definer
set search_path = public, app_private
as $$
  select case
    when exists (
      select 1 from public.application_events
      where application_id = p_application_id
        and user_id = p_user_id
        and event_type = 'offer'
    ) then 'offer'
    when exists (
      select 1 from public.application_events
      where application_id = p_application_id
        and user_id = p_user_id
        and event_type = 'rejected'
    ) then 'rejected'
    when exists (
      select 1 from public.application_events
      where application_id = p_application_id
        and user_id = p_user_id
        and event_type = 'interview'
    ) then 'interview'
    when exists (
      select 1 from public.application_events
      where application_id = p_application_id
        and user_id = p_user_id
        and event_type = 'oa'
    ) then 'oa'
    else 'applied'
  end;
$$;

create or replace function app_private.enforce_application_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if tg_op = 'INSERT' then
    new.status := 'applied';
    perform app_private.enforce_rate_limit(v_user_id::text, 'applications:insert', 30, 600);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status
      and new.status is distinct from app_private.derive_application_status(new.id, new.user_id) then
      raise exception 'Application status must match its event history';
    end if;

    perform app_private.enforce_rate_limit(v_user_id::text, 'applications:update', 120, 600);
    return new;
  elsif tg_op = 'DELETE' then
    perform app_private.enforce_rate_limit(v_user_id::text, 'applications:delete', 30, 600);
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function app_private.enforce_event_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if tg_op = 'INSERT' then
    perform app_private.enforce_rate_limit(v_user_id::text, 'application_events:insert', 90, 600);
    return new;
  elsif tg_op = 'UPDATE' then
    perform app_private.enforce_rate_limit(v_user_id::text, 'application_events:update', 180, 600);
    return new;
  elsif tg_op = 'DELETE' then
    perform app_private.enforce_rate_limit(v_user_id::text, 'application_events:delete', 90, 600);
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function app_private.enforce_feed_interaction_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform app_private.enforce_rate_limit(v_user_id::text, 'feed_interactions:write', 240, 600);
  return coalesce(new, old);
end;
$$;

create or replace function app_private.enforce_event_application_owner()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
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

create or replace function app_private.enforce_user_preferences_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
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
    perform app_private.enforce_rate_limit(v_user_id::text, 'user_preferences:write', 60, 600);
    return new;
  end if;

  return old;
end;
$$;

create or replace function app_private.sync_application_status_from_events()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_application_id uuid;
  v_user_id uuid;
begin
  v_application_id := coalesce(new.application_id, old.application_id);
  v_user_id := coalesce(new.user_id, old.user_id);

  if v_application_id is not null and v_user_id is not null then
    update public.applications
    set status = app_private.derive_application_status(v_application_id, v_user_id)
    where id = v_application_id
      and user_id = v_user_id;
  end if;

  if tg_op = 'UPDATE'
    and old.application_id is distinct from new.application_id
    and old.application_id is not null
    and old.user_id is not null then
    update public.applications
    set status = app_private.derive_application_status(old.application_id, old.user_id)
    where id = old.application_id
      and user_id = old.user_id;
  end if;

  return null;
end;
$$;

drop trigger if exists applications_rate_limit on public.applications;
create trigger applications_rate_limit
  before insert or update or delete on public.applications
  for each row execute function app_private.enforce_application_write_rate_limit();

drop trigger if exists application_events_owner_guard on public.application_events;
create trigger application_events_owner_guard
  before insert or update on public.application_events
  for each row execute function app_private.enforce_event_application_owner();

drop trigger if exists application_events_rate_limit on public.application_events;
create trigger application_events_rate_limit
  before insert or update or delete on public.application_events
  for each row execute function app_private.enforce_event_write_rate_limit();

drop trigger if exists application_events_sync_status on public.application_events;
create trigger application_events_sync_status
  after insert or update or delete on public.application_events
  for each row execute function app_private.sync_application_status_from_events();

drop trigger if exists feed_interactions_rate_limit on public.feed_interactions;
create trigger feed_interactions_rate_limit
  before insert or delete on public.feed_interactions
  for each row execute function app_private.enforce_feed_interaction_write_rate_limit();

drop trigger if exists user_preferences_rate_limit on public.user_preferences;
create trigger user_preferences_rate_limit
  before insert or update on public.user_preferences
  for each row execute function app_private.enforce_user_preferences_write_rate_limit();

drop policy if exists "users can read own applications" on public.applications;
drop policy if exists "users can insert own applications" on public.applications;
drop policy if exists "users can update own applications" on public.applications;
drop policy if exists "users can delete own applications" on public.applications;

create policy "users can read own applications"
  on public.applications for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert own applications"
  on public.applications for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update own applications"
  on public.applications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete own applications"
  on public.applications for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can view own events" on public.application_events;
drop policy if exists "users can insert own events" on public.application_events;
drop policy if exists "users can update own events" on public.application_events;
drop policy if exists "users can delete own events" on public.application_events;

create policy "users can view own events"
  on public.application_events for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "users can insert own events"
  on public.application_events for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "users can update own events"
  on public.application_events for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and a.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and a.user_id = (select auth.uid())
    )
  );

create policy "users can delete own events"
  on public.application_events for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and event_type <> 'applied'
    and exists (
      select 1
      from public.applications a
      where a.id = application_events.application_id
        and a.user_id = (select auth.uid())
    )
  );

drop policy if exists "users can read own feed interactions" on public.feed_interactions;
drop policy if exists "users can insert own feed interactions" on public.feed_interactions;
drop policy if exists "users can delete own feed interactions" on public.feed_interactions;

create policy "users can read own feed interactions"
  on public.feed_interactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert own feed interactions"
  on public.feed_interactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can delete own feed interactions"
  on public.feed_interactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users can read own preferences" on public.user_preferences;
drop policy if exists "users can insert own preferences" on public.user_preferences;
drop policy if exists "users can update own preferences" on public.user_preferences;

create policy "users can read own preferences"
  on public.user_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert own preferences"
  on public.user_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update own preferences"
  on public.user_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.applications
  drop constraint if exists applications_posting_url_shape_check;

alter table public.applications
  add constraint applications_posting_url_shape_check
  check (
    posting_url is null
    or (
      char_length(posting_url) <= 2048
      and posting_url ~* '^https?://[^[:space:]]+$'
      and posting_url !~* '^https?://[^/?#]*@'
      and posting_url !~* '^https?://(localhost|([^.@/?#]+[.])*localhost[.]?|127[.]|10[.]|169[.]254[.]|192[.]168[.]|172[.](1[6-9]|2[0-9]|3[0-1])[.]|0[.])'
      and lower(posting_url) not like 'http://[::1]%'
      and lower(posting_url) not like 'https://[::1]%'
      and lower(posting_url) not like 'http://[fe80:%'
      and lower(posting_url) not like 'https://[fe80:%'
      and lower(posting_url) not like 'http://[fc%'
      and lower(posting_url) not like 'https://[fc%'
      and lower(posting_url) not like 'http://[fd%'
      and lower(posting_url) not like 'https://[fd%'
    )
  );

alter table public.application_events
  drop constraint if exists application_events_deadline_type_check;

alter table public.application_events
  add constraint application_events_deadline_type_check
  check (deadline_date is null or event_type = 'oa');

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
security invoker
set search_path = public
as $$
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

  if p_season is not null and p_season not in ('Summer', 'Fall') then
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
$$;

revoke all on function public.create_application_with_event(text, text, text, text, text, date) from public, anon, authenticated;
grant execute on function public.create_application_with_event(text, text, text, text, text, date) to authenticated;

create or replace function public.create_application_event(
  p_application_id uuid,
  p_event_type text,
  p_event_date date,
  p_notes text default null,
  p_deadline_date date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid;
  v_application_id uuid;
  v_round_number integer;
  v_event jsonb;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_event_type not in ('oa', 'interview', 'offer', 'rejected', 'note') then
    raise exception 'Invalid event type';
  end if;

  if p_event_type <> 'oa' and p_deadline_date is not null then
    raise exception 'Deadlines can only be added to OA events';
  end if;

  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'Notes are too long';
  end if;

  select id
  into v_application_id
  from public.applications
  where id = p_application_id
    and user_id = v_user_id
  for update;

  if v_application_id is null then
    raise exception 'Application not found';
  end if;

  if p_event_type = 'interview' then
    select coalesce(max(round_number), 0) + 1
    into v_round_number
    from public.application_events
    where application_id = p_application_id
      and event_type = 'interview';
  else
    v_round_number := null;
  end if;

  insert into public.application_events (
    application_id,
    user_id,
    event_type,
    event_date,
    notes,
    round_number,
    deadline_date
  )
  values (
    p_application_id,
    v_user_id,
    p_event_type,
    p_event_date,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_round_number,
    p_deadline_date
  )
  returning to_jsonb(application_events.*) into v_event;

  select status
  into v_status
  from public.applications
  where id = p_application_id
    and user_id = v_user_id;

  return jsonb_build_object('event', v_event, 'status', v_status);
end;
$$;

revoke all on function public.create_application_event(uuid, text, date, text, date) from public, anon, authenticated;
grant execute on function public.create_application_event(uuid, text, date, text, date) to authenticated;

revoke all on function app_private.enforce_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function app_private.derive_application_status(uuid, uuid) from public, anon, authenticated;
revoke all on function app_private.enforce_application_write_rate_limit() from public, anon, authenticated;
revoke all on function app_private.enforce_event_write_rate_limit() from public, anon, authenticated;
revoke all on function app_private.enforce_feed_interaction_write_rate_limit() from public, anon, authenticated;
revoke all on function app_private.enforce_event_application_owner() from public, anon, authenticated;
revoke all on function app_private.enforce_user_preferences_write_rate_limit() from public, anon, authenticated;
revoke all on function app_private.sync_application_status_from_events() from public, anon, authenticated;

drop function if exists public.enforce_rate_limit(text, text, integer, integer);
drop function if exists public.derive_application_status(uuid, uuid);
drop function if exists public.enforce_application_write_rate_limit();
drop function if exists public.enforce_event_write_rate_limit();
drop function if exists public.enforce_feed_interaction_write_rate_limit();
drop function if exists public.enforce_event_application_owner();
drop function if exists public.enforce_user_preferences_write_rate_limit();
drop function if exists public.sync_application_status_from_events();

drop function if exists public.profiles_touch_updated_at();
drop function if exists public.set_auto_apply_updated_at();
