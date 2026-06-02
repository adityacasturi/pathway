-- Scraped posting store for Discover (ATS boards). Live feed remains GitHub-only.

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
  source_type text not null check (source_type in ('ashby', 'greenhouse', 'lever')),
  adapter_key text not null,
  source_url text,
  board_token text,
  enabled boolean not null default true,
  scrape_interval_minutes integer not null default 240 check (scrape_interval_minutes between 60 and 10080),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_sources_adapter_key_not_blank check (length(btrim(adapter_key)) > 0),
  constraint company_sources_has_locator check (
    nullif(btrim(coalesce(source_url, '')), '') is not null
    or nullif(btrim(coalesce(board_token, '')), '') is not null
  )
);

create table public.scraped_postings (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null references public.companies(id) on delete restrict,
  company_name text not null,
  role_name text not null,
  posting_url text not null,
  season text not null default 'Summer' check (season in ('Summer', 'Fall', 'Spring', 'Winter')),
  location text,
  date_posted timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scraped_postings_company_name_not_blank check (length(btrim(company_name)) > 0),
  constraint scraped_postings_role_name_not_blank check (length(btrim(role_name)) > 0),
  constraint scraped_postings_posting_url_not_blank check (length(btrim(posting_url)) > 0),
  constraint scraped_postings_posting_url_length check (char_length(posting_url) <= 2048),
  constraint scraped_postings_seen_dates_valid check (first_seen_at <= last_seen_at),
  constraint scraped_postings_posting_url_unique unique (posting_url)
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

create index scraped_postings_company_status_idx
  on public.scraped_postings (company_id, status);

create index scraped_postings_status_last_seen_idx
  on public.scraped_postings (status, last_seen_at desc);

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

create trigger scraped_postings_touch_updated_at
  before update on public.scraped_postings
  for each row execute function app_private.touch_updated_at();

alter table public.companies enable row level security;
alter table public.company_sources enable row level security;
alter table public.scraped_postings enable row level security;

revoke all on public.companies from anon, authenticated;
revoke all on public.company_sources from anon, authenticated;
revoke all on public.scraped_postings from anon, authenticated;

grant select on public.companies to authenticated;
grant select on public.scraped_postings to authenticated;
grant select on public.company_sources to authenticated;

create policy "authenticated users can read companies"
  on public.companies for select
  to authenticated
  using (true);

create policy "authenticated users can read scraped postings"
  on public.scraped_postings for select
  to authenticated
  using (true);

create policy "authenticated users can read enabled company sources"
  on public.company_sources for select
  to authenticated
  using (enabled = true);

create policy "clients cannot insert company sources"
  on public.company_sources for insert
  to public
  with check (false);

create policy "clients cannot update company sources"
  on public.company_sources for update
  to public
  using (false)
  with check (false);

create policy "clients cannot delete company sources"
  on public.company_sources for delete
  to public
  using (false);

create policy "clients cannot insert scraped postings"
  on public.scraped_postings for insert
  to public
  with check (false);

create policy "clients cannot update scraped postings"
  on public.scraped_postings for update
  to public
  using (false)
  with check (false);

create policy "clients cannot delete scraped postings"
  on public.scraped_postings for delete
  to public
  using (false);

create policy "clients cannot insert companies"
  on public.companies for insert
  to public
  with check (false);

create policy "clients cannot update companies"
  on public.companies for update
  to public
  using (false)
  with check (false);

create policy "clients cannot delete companies"
  on public.companies for delete
  to public
  using (false);

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  ('stripe', 'Stripe', 'https://stripe.com', 'https://stripe.com/jobs', 1),
  ('ramp', 'Ramp', 'https://ramp.com', 'https://ramp.com/careers', 2)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
  is_active = true,
  updated_at = now();

insert into public.company_sources (
  company_id,
  source_type,
  adapter_key,
  source_url,
  board_token,
  enabled,
  scrape_interval_minutes
)
values
  (
    (select id from public.companies where slug = 'stripe'),
    'greenhouse',
    'stripe-greenhouse',
    'https://boards.greenhouse.io/stripe',
    'stripe',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'ramp'),
    'ashby',
    'ramp-ashby',
    'https://jobs.ashbyhq.com/ramp',
    'ramp',
    true,
    240
  )
on conflict (
  company_id,
  source_type,
  adapter_key,
  coalesce(board_token, ''),
  coalesce(source_url, '')
) do update set
  enabled = true,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
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
  where cs.enabled and c.id is null;
$$;

revoke all on function app_private.production_integrity_check() from public, anon, authenticated;
