-- Migration 015: add application location/season and harden event RLS.
--
-- The current application UI and server actions depend on location/season.
--
-- Also tighten application_events policies so a row is only valid when its
-- application_id belongs to the same authenticated user. This prevents a
-- crafted client from pairing its own user_id with another user's application.

alter table applications
add column if not exists location text;

alter table applications
add column if not exists season text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'applications_season_check'
      and conrelid = 'applications'::regclass
  ) then
    alter table applications
      add constraint applications_season_check
      check (season is null or season in ('Summer', 'Fall'));
  end if;
end $$;

drop policy if exists "users can view own events" on application_events;
drop policy if exists "users can insert own events" on application_events;
drop policy if exists "users can update own events" on application_events;
drop policy if exists "users can delete own events" on application_events;

create policy "users can view own events"
  on application_events for select
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from applications a
      where a.id = application_events.application_id
        and a.user_id = auth.uid()
    )
  );

create policy "users can insert own events"
  on application_events for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from applications a
      where a.id = application_events.application_id
        and a.user_id = auth.uid()
    )
  );

create policy "users can update own events"
  on application_events for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from applications a
      where a.id = application_events.application_id
        and a.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from applications a
      where a.id = application_events.application_id
        and a.user_id = auth.uid()
    )
  );

create policy "users can delete own events"
  on application_events for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from applications a
      where a.id = application_events.application_id
        and a.user_id = auth.uid()
    )
  );
