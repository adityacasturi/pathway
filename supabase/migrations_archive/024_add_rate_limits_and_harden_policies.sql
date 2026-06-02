-- Migration 024: production hardening and database-backed rate limits.
--
-- Server Actions are not the only mutation path: authenticated users can also
-- call Supabase directly with the anon key. These triggers throttle writes at
-- the database layer so direct API abuse is covered too.

create table if not exists public.rate_limits (
  subject text not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject, bucket, window_start)
);

alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from anon, authenticated;

create index if not exists rate_limits_updated_at_idx
  on public.rate_limits (updated_at);

create or replace function public.enforce_rate_limit(
  p_subject text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return public.enforce_rate_limit(v_user_id::text, p_bucket, p_limit, p_window_seconds);
end;
$$;

revoke all on function public.enforce_rate_limit(text, text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

create or replace function public.derive_application_status(
  p_application_id uuid,
  p_user_id uuid
)
returns text
language sql
security definer
set search_path = public
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

revoke all on function public.derive_application_status(uuid, uuid) from public;

create or replace function public.enforce_application_write_rate_limit()
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

  if tg_op = 'INSERT' then
    new.status := 'applied';
    perform public.enforce_rate_limit(v_user_id::text, 'applications:insert', 30, 600);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status
      and new.status is distinct from public.derive_application_status(new.id, new.user_id) then
      raise exception 'Application status must match its event history';
    end if;

    perform public.enforce_rate_limit(v_user_id::text, 'applications:update', 120, 600);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.enforce_rate_limit(v_user_id::text, 'applications:delete', 30, 600);
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.enforce_event_write_rate_limit()
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

  if tg_op = 'INSERT' then
    perform public.enforce_rate_limit(v_user_id::text, 'application_events:insert', 90, 600);
    return new;
  elsif tg_op = 'UPDATE' then
    perform public.enforce_rate_limit(v_user_id::text, 'application_events:update', 180, 600);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.enforce_rate_limit(v_user_id::text, 'application_events:delete', 90, 600);
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.enforce_feed_interaction_write_rate_limit()
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

  perform public.enforce_rate_limit(v_user_id::text, 'feed_interactions:write', 240, 600);
  return coalesce(new, old);
end;
$$;

drop trigger if exists applications_rate_limit on public.applications;
create trigger applications_rate_limit
  before insert or update or delete on public.applications
  for each row execute function public.enforce_application_write_rate_limit();

drop trigger if exists application_events_rate_limit on public.application_events;
create trigger application_events_rate_limit
  before insert or update or delete on public.application_events
  for each row execute function public.enforce_event_write_rate_limit();

drop trigger if exists feed_interactions_rate_limit on public.feed_interactions;
create trigger feed_interactions_rate_limit
  before insert or delete on public.feed_interactions
  for each row execute function public.enforce_feed_interaction_write_rate_limit();

drop policy if exists "users can update own applications" on public.applications;
create policy "users can update own applications"
  on public.applications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
