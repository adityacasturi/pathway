-- Per-user starred Discover companies for quick access at the top of /discover.

create table public.discover_company_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create index discover_company_favorites_user_idx
  on public.discover_company_favorites (user_id);

alter table public.discover_company_favorites enable row level security;

revoke all on table public.discover_company_favorites from anon, authenticated;
grant select, insert, delete on table public.discover_company_favorites to authenticated;

create policy "users can read own discover company favorites"
  on public.discover_company_favorites for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert own discover company favorites"
  on public.discover_company_favorites for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can delete own discover company favorites"
  on public.discover_company_favorites for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function app_private.enforce_discover_company_favorite_write_rate_limit()
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

  perform app_private.enforce_rate_limit(
    v_user_id::text,
    'discover_company_favorites:write',
    120,
    600
  );
  return coalesce(new, old);
end;
$$;

create trigger discover_company_favorites_rate_limit
  before insert or delete on public.discover_company_favorites
  for each row execute function app_private.enforce_discover_company_favorite_write_rate_limit();

create or replace function app_private.production_integrity_check()
returns table (
  check_name text,
  violations integer
)
language sql
security definer
set search_path = public, app_private
as $$
  select 'applications.invalid_status', count(*)::integer
  from public.applications a
  where a.status is distinct from app_private.derive_application_status(a.id, a.user_id)

  union all
  select 'applications.missing_applied_event', count(*)::integer
  from public.applications a
  where not exists (
    select 1
    from public.application_events e
    where e.application_id = a.id
      and e.user_id = a.user_id
      and e.event_type = 'applied'
  )

  union all
  select 'application_events.orphaned_or_mismatched_owner', count(*)::integer
  from public.application_events e
  left join public.applications a on a.id = e.application_id
  where a.id is null or a.user_id is distinct from e.user_id

  union all
  select 'application_events.duplicate_applied', count(*)::integer
  from (
    select application_id
    from public.application_events
    where event_type = 'applied'
    group by application_id
    having count(*) > 1
  ) duplicates

  union all
  select 'application_events.duplicate_interview_round', count(*)::integer
  from (
    select application_id, round_number
    from public.application_events
    where event_type = 'interview'
    group by application_id, round_number
    having count(*) > 1
  ) duplicates

  union all
  select 'application_events.invalid_deadline', count(*)::integer
  from public.application_events
  where (event_type <> 'oa' and (deadline_date is not null or deadline_completed_at is not null))
     or (deadline_completed_at is not null and deadline_date is null)

  union all
  select 'feed_interactions.invalid_posting_id', count(*)::integer
  from public.feed_interactions
  where posting_id <> btrim(posting_id)
     or char_length(posting_id) not between 1 and 300

  union all
  select 'scraped_postings.invalid_status_or_season', count(*)::integer
  from public.scraped_postings
  where status not in ('open', 'closed')
     or season not in ('Summer', 'Fall', 'Spring', 'Winter')

  union all
  select 'scraped_postings.orphaned_company', count(*)::integer
  from public.scraped_postings sp
  left join public.companies c on c.id = sp.company_id
  where c.id is null

  union all
  select 'company_sources.enabled_without_company', count(*)::integer
  from public.company_sources cs
  left join public.companies c on c.id = cs.company_id
  where cs.enabled and c.id is null

  union all
  select 'discover_company_favorites.orphaned_company', count(*)::integer
  from public.discover_company_favorites f
  left join public.companies c on c.id = f.company_id
  where c.id is null;
$$;

revoke all on function app_private.production_integrity_check() from public, anon, authenticated;
