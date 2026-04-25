create table application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  event_type     text not null check (event_type in ('applied','oa','interview','offer','rejected','note')),
  event_date     date not null,
  notes          text,
  round_number   int,
  created_at     timestamptz not null default now()
);

alter table application_events enable row level security;

create policy "users can view own events"
  on application_events for select
  using (auth.uid() = user_id);

create policy "users can insert own events"
  on application_events for insert
  with check (auth.uid() = user_id);

create policy "users can delete own events"
  on application_events for delete
  using (auth.uid() = user_id);

-- Seed one 'applied' event for every existing application
insert into application_events (application_id, user_id, event_type, event_date)
select id, user_id, 'applied', created_at::date
from applications;
