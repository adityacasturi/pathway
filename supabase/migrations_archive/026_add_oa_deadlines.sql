alter table application_events
add column if not exists deadline_date date;

alter table application_events
add column if not exists deadline_completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'application_events_oa_deadline_check'
      and conrelid = 'application_events'::regclass
  ) then
    alter table application_events
      add constraint application_events_oa_deadline_check
      check (
        event_type = 'oa'
        or (deadline_date is null and deadline_completed_at is null)
      );
  end if;
end $$;
