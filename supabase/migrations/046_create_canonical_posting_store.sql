-- Create the canonical posting store that will eventually replace the
-- third-party Discover feed. Scrapers write incrementally into these tables:
-- no truncate/refill cycle is needed for normal polling.

create table public.companies (
  id uuid default gen_random_uuid() primary key,
  slug text not null,
  name text not null,
  website_url text,
  careers_url text,
  priority integer not null default 100 check (priority >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_slug_unique unique (slug),
  constraint companies_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint companies_name_not_blank check (length(btrim(name)) > 0)
);

create table public.company_sources (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null check (source_type in (
    'ashby',
    'greenhouse',
    'lever',
    'workday',
    'custom',
    'manual'
  )),
  adapter_key text not null,
  source_url text,
  board_token text,
  enabled boolean not null default true,
  scrape_interval_minutes integer not null default 180 check (scrape_interval_minutes between 15 and 10080),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_sources_adapter_key_not_blank check (length(btrim(adapter_key)) > 0),
  constraint company_sources_has_locator check (
    nullif(btrim(coalesce(source_url, '')), '') is not null
    or nullif(btrim(coalesce(board_token, '')), '') is not null
  ),
  constraint company_sources_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.postings (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete restrict,
  company_name text not null,
  role_name text not null,
  role_name_raw text,
  posting_url text not null,
  canonical_url text not null,
  date_posted timestamptz,
  date_posted_source text not null default 'unknown' check (date_posted_source in (
    'ats',
    'page',
    'inferred',
    'unknown'
  )),
  season text not null default 'Unknown' check (season in (
    'Summer',
    'Fall',
    'Spring',
    'Winter',
    'Year-round',
    'Unknown'
  )),
  season_year integer check (season_year is null or season_year between 2020 and 2100),
  season_source text not null default 'unknown' check (season_source in (
    'ats_field',
    'title',
    'description',
    'inferred',
    'unknown'
  )),
  locations text[] not null default '{}'::text[],
  location_raw text,
  countries text[] not null default '{}'::text[],
  is_remote boolean not null default false,
  status text not null default 'open' check (status in (
    'open',
    'stale',
    'closed',
    'unknown'
  )),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  content_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint postings_company_name_not_blank check (length(btrim(company_name)) > 0),
  constraint postings_role_name_not_blank check (length(btrim(role_name)) > 0),
  constraint postings_posting_url_not_blank check (length(btrim(posting_url)) > 0),
  constraint postings_canonical_url_not_blank check (length(btrim(canonical_url)) > 0),
  constraint postings_seen_dates_valid check (first_seen_at <= last_seen_at),
  constraint postings_closed_at_valid check (closed_at is null or closed_at >= first_seen_at),
  constraint postings_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint postings_canonical_url_unique unique (canonical_url)
);

create table public.posting_source_observations (
  id uuid default gen_random_uuid() primary key,
  posting_id uuid not null references public.postings(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  company_source_id uuid not null references public.company_sources(id) on delete cascade,
  source_type text not null check (source_type in (
    'ashby',
    'greenhouse',
    'lever',
    'workday',
    'custom',
    'manual'
  )),
  external_job_id text,
  source_url text not null,
  observed_url text not null,
  canonical_url text not null,
  content_hash text,
  raw_payload_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  last_successful_scrape_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posting_source_observations_external_job_id_not_blank check (
    external_job_id is null or length(btrim(external_job_id)) > 0
  ),
  constraint posting_source_observations_source_url_not_blank check (length(btrim(source_url)) > 0),
  constraint posting_source_observations_observed_url_not_blank check (length(btrim(observed_url)) > 0),
  constraint posting_source_observations_canonical_url_not_blank check (length(btrim(canonical_url)) > 0),
  constraint posting_source_observations_seen_dates_valid check (first_seen_at <= last_seen_at),
  constraint posting_source_observations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create unique index company_sources_unique_locator_idx
  on public.company_sources (
    company_id,
    source_type,
    adapter_key,
    coalesce(board_token, ''),
    coalesce(source_url, '')
  );

create index company_sources_enabled_idx
  on public.company_sources (enabled, scrape_interval_minutes);

create index postings_company_status_idx
  on public.postings (company_id, status, last_seen_at desc);

create index postings_status_first_seen_idx
  on public.postings (status, first_seen_at desc);

create index postings_date_posted_idx
  on public.postings (date_posted desc nulls last);

create index postings_season_idx
  on public.postings (season, season_year);

create index postings_locations_gin_idx
  on public.postings using gin (locations);

create index postings_countries_gin_idx
  on public.postings using gin (countries);

create unique index posting_source_observations_external_job_unique_idx
  on public.posting_source_observations (company_source_id, external_job_id)
  where external_job_id is not null;

create unique index posting_source_observations_source_canonical_unique_idx
  on public.posting_source_observations (company_source_id, canonical_url);

create index posting_source_observations_posting_idx
  on public.posting_source_observations (posting_id);

create index posting_source_observations_last_seen_idx
  on public.posting_source_observations (last_seen_at desc);

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function app_private.touch_updated_at();

create trigger company_sources_touch_updated_at
  before update on public.company_sources
  for each row execute function app_private.touch_updated_at();

create trigger postings_touch_updated_at
  before update on public.postings
  for each row execute function app_private.touch_updated_at();

create trigger posting_source_observations_touch_updated_at
  before update on public.posting_source_observations
  for each row execute function app_private.touch_updated_at();

alter table public.companies enable row level security;
alter table public.company_sources enable row level security;
alter table public.postings enable row level security;
alter table public.posting_source_observations enable row level security;

revoke all on public.companies from anon, authenticated;
revoke all on public.company_sources from anon, authenticated;
revoke all on public.postings from anon, authenticated;
revoke all on public.posting_source_observations from anon, authenticated;

grant select on public.companies to authenticated;
grant select on public.postings to authenticated;

create policy "authenticated users can read companies"
  on public.companies for select
  to authenticated
  using (true);

create policy "authenticated users can read postings"
  on public.postings for select
  to authenticated
  using (true);

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  ('apple', 'Apple', 'https://www.apple.com', 'https://jobs.apple.com', 1),
  ('google', 'Google', 'https://www.google.com', 'https://www.google.com/about/careers/applications/jobs/results', 2),
  ('meta', 'Meta', 'https://www.meta.com', 'https://www.metacareers.com/jobs', 3),
  ('amazon', 'Amazon', 'https://www.amazon.com', 'https://www.amazon.jobs', 4),
  ('citadel', 'Citadel', 'https://www.citadel.com', 'https://www.citadel.com/careers/open-opportunities', 5),
  ('jane-street', 'Jane Street', 'https://www.janestreet.com', 'https://www.janestreet.com/join-jane-street/open-roles', 6),
  ('optiver', 'Optiver', 'https://optiver.com', 'https://optiver.com/working-at-optiver/career-opportunities', 7),
  ('microsoft', 'Microsoft', 'https://www.microsoft.com', 'https://jobs.careers.microsoft.com/global/en/search', 8),
  ('tesla', 'Tesla', 'https://www.tesla.com', 'https://www.tesla.com/careers/search', 9),
  ('nvidia', 'NVIDIA', 'https://www.nvidia.com', 'https://www.nvidia.com/en-us/about-nvidia/careers', 10)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
  is_active = true,
  updated_at = now();

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
  select 'companies.invalid_slug_or_name', count(*)::integer
  from public.companies
  where slug <> lower(slug)
     or slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or length(btrim(name)) = 0

  union all
  select 'postings.invalid_dates', count(*)::integer
  from public.postings
  where first_seen_at > last_seen_at
     or (closed_at is not null and closed_at < first_seen_at)

  union all
  select 'postings.invalid_required_fields', count(*)::integer
  from public.postings
  where length(btrim(company_name)) = 0
     or length(btrim(role_name)) = 0
     or length(btrim(posting_url)) = 0
     or length(btrim(canonical_url)) = 0

  union all
  select 'posting_source_observations.company_mismatch', count(*)::integer
  from public.posting_source_observations o
  join public.postings p on p.id = o.posting_id
  where p.company_id is distinct from o.company_id;
$$;

revoke all on function app_private.production_integrity_check() from public, anon, authenticated;
