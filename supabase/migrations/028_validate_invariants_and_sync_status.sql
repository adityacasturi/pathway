-- Migration 028: validate production invariants and keep derived status synced.
--
-- Pass 027 added NOT VALID constraints so deploys would not fail on historical
-- data. The live project currently has no violations, so these constraints can
-- be validated and used by the planner. This migration also makes application
-- status robust against direct Supabase API writes to application_events.

create index if not exists applications_user_created_idx
  on public.applications (user_id, created_at desc);

create index if not exists application_events_user_idx
  on public.application_events (user_id);

create index if not exists application_events_user_application_idx
  on public.application_events (user_id, application_id);

create index if not exists application_events_application_date_idx
  on public.application_events (application_id, event_date, created_at);

create or replace function public.validate_constraint_if_present(
  p_table regclass,
  p_constraint text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = p_table
      and conname = p_constraint
      and not convalidated
  ) then
    execute format('alter table %s validate constraint %I', p_table, p_constraint);
  end if;
end;
$$;

select public.validate_constraint_if_present('public.applications'::regclass, 'applications_company_shape_check');
select public.validate_constraint_if_present('public.applications'::regclass, 'applications_role_shape_check');
select public.validate_constraint_if_present('public.applications'::regclass, 'applications_location_shape_check');
select public.validate_constraint_if_present('public.applications'::regclass, 'applications_posting_url_shape_check');
select public.validate_constraint_if_present('public.application_events'::regclass, 'application_events_notes_length_check');
select public.validate_constraint_if_present('public.application_events'::regclass, 'application_events_round_number_check');
select public.validate_constraint_if_present('public.application_events'::regclass, 'application_events_deadline_completion_check');
select public.validate_constraint_if_present('public.feed_interactions'::regclass, 'feed_interactions_posting_id_shape_check');

drop function if exists public.validate_constraint_if_present(regclass, text);

create or replace function public.sync_application_status_from_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application_id uuid;
  v_user_id uuid;
begin
  v_application_id := coalesce(new.application_id, old.application_id);
  v_user_id := coalesce(new.user_id, old.user_id);

  if v_application_id is not null and v_user_id is not null then
    update public.applications
    set status = public.derive_application_status(v_application_id, v_user_id)
    where id = v_application_id
      and user_id = v_user_id;
  end if;

  if tg_op = 'UPDATE'
    and old.application_id is distinct from new.application_id
    and old.application_id is not null
    and old.user_id is not null then
    update public.applications
    set status = public.derive_application_status(old.application_id, old.user_id)
    where id = old.application_id
      and user_id = old.user_id;
  end if;

  return null;
end;
$$;

drop trigger if exists application_events_sync_status on public.application_events;
create trigger application_events_sync_status
  after insert or update or delete on public.application_events
  for each row execute function public.sync_application_status_from_events();
