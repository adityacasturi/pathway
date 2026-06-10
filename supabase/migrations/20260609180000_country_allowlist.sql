-- Country allowlist: database-backed country filtering for scraped postings.

-- 1. allowed_countries table -------------------------------------------------

create table if not exists public.allowed_countries (
  country_code  text primary key
    check (country_code = upper(country_code) and char_length(country_code) = 2),
  country_name  text not null check (char_length(country_name) > 0),
  enabled       boolean not null default false,
  tier          integer check (tier is null or tier between 1 and 9),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.allowed_countries is
  'ISO 3166-1 alpha-2 country allowlist. enabled=true countries appear in the public feed.';

alter table public.allowed_countries enable row level security;

create policy "allowed_countries_authenticated_read"
  on public.allowed_countries
  for select
  to authenticated
  using (true);

grant select on public.allowed_countries to authenticated;

create trigger allowed_countries_touch_updated_at
  before update on public.allowed_countries
  for each row execute function app_private.touch_updated_at();

-- 2. Seed data ---------------------------------------------------------------

insert into public.allowed_countries (country_code, country_name, enabled, tier) values
  ('US', 'United States',  true,  1),
  ('CA', 'Canada',         true,  1),
  ('GB', 'United Kingdom', true,  1),
  ('CH', 'Switzerland',    true,  1),
  ('SG', 'Singapore',      true,  1),
  ('AU', 'Australia',      true,  1),
  ('DE', 'Germany',        false, 2),
  ('NL', 'Netherlands',    false, 2),
  ('FR', 'France',         false, 2),
  ('IE', 'Ireland',        false, 2),
  ('SE', 'Sweden',         false, 2),
  ('NO', 'Norway',         false, 2),
  ('DK', 'Denmark',        false, 2),
  ('FI', 'Finland',        false, 2),
  ('AT', 'Austria',        false, 2),
  ('BE', 'Belgium',        false, 2),
  ('NZ', 'New Zealand',    false, 2),
  ('HK', 'Hong Kong',      false, 2),
  ('JP', 'Japan',          false, 2),
  ('KR', 'South Korea',    false, 2),
  ('IL', 'Israel',         false, 2),
  ('IN', 'India',          false, 2),
  ('PT', 'Portugal',       false, 2),
  ('ES', 'Spain',          false, 2),
  ('IT', 'Italy',          false, 2),
  ('PL', 'Poland',         false, 2)
on conflict (country_code) do nothing;

-- 3. Extend scraped_postings.status ------------------------------------------

alter table public.scraped_postings
  drop constraint scraped_postings_status_check,
  add constraint scraped_postings_status_check
    check (status = any (array[
      'open'::text,
      'closed'::text,
      'country_blocked'::text,
      'country_unknown'::text
    ]));

-- 4. Partial index for admin review queries -----------------------------------

create index if not exists scraped_postings_review_idx
  on public.scraped_postings (status, first_seen_at desc)
  where status in ('country_blocked', 'country_unknown');

-- 5. Backfill existing open postings -----------------------------------------

-- Unknown country first (empty countries array → no geo resolution)
update public.scraped_postings
set status = 'country_unknown'
where status = 'open'
  and countries = '{}';

-- Country resolved but not in the enabled allowlist
update public.scraped_postings
set status = 'country_blocked'
where status = 'open'
  and countries <> '{}'
  and not exists (
    select 1
    from public.allowed_countries ac
    where ac.enabled = true
      and ac.country_code = any(scraped_postings.countries)
  );

-- 6. Update production_integrity_check to accept new statuses ----------------

create or replace function app_private.production_integrity_check()
returns table(check_name text, violations integer)
language sql
security definer
set search_path = ''
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
  where status not in ('open', 'closed', 'country_blocked', 'country_unknown')
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
