-- Scraping pipeline rebuild: global locations, honest unknowns, run observability.
-- (Applied to hosted Supabase via apply_migration as global_scraping_pipeline_rebuild.)

-- 1. scraped_postings: honest nulls + provenance ------------------------------

-- Season was NOT NULL DEFAULT 'Summer' — a fake value when the source states
-- no season. Unknown is now stored as NULL.
alter table public.scraped_postings
  alter column season drop default,
  alter column season drop not null;

-- Original ATS location string(s), preserved verbatim for debugging and as an
-- honest fallback display when normalization cannot produce places.
alter table public.scraped_postings
  add column if not exists raw_location text
    check (raw_location is null or char_length(raw_location) <= 600);

-- Classifier output: what kind of student opportunity this is.
alter table public.scraped_postings
  add column if not exists role_type text not null default 'internship'
    check (role_type in ('internship', 'co_op', 'new_grad'));

-- Which company_sources row produced the posting (adapter identity for debugging).
alter table public.scraped_postings
  add column if not exists source_id uuid
    references public.company_sources(id) on delete set null;

create index if not exists scraped_postings_source_id_idx
  on public.scraped_postings (source_id);

-- US-only product scope is removed; the US-specific partial index is obsolete.
drop index if exists public.scraped_postings_open_us_company_idx;

-- 2. company_sources: zero-result suspicion tracking --------------------------

alter table public.company_sources
  add column if not exists last_fetched_count integer
    check (last_fetched_count is null or last_fetched_count >= 0),
  add column if not exists last_kept_count integer
    check (last_kept_count is null or last_kept_count >= 0);

comment on column public.company_sources.last_fetched_count is
  'Raw roles returned by the previous successful scrape; a drop to zero flags suspicious_zero.';
comment on column public.company_sources.last_kept_count is
  'Relevant roles kept by the previous successful scrape.';

-- 3. scrape_runs: per-run summary for production observability ----------------

create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  shard_index integer,
  shard_count integer,
  sources_total integer not null default 0,
  sources_ok integer not null default 0,
  sources_failed integer not null default 0,
  sources_suspicious integer not null default 0,
  roles_fetched integer not null default 0,
  roles_kept integer not null default 0,
  -- Compact list of sources needing attention: [{slug, status, error}]
  attention jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (started_at <= finished_at)
);

create index if not exists scrape_runs_started_at_idx
  on public.scrape_runs (started_at desc);

-- Service-role only (cron/scripts); no client access.
alter table public.scrape_runs enable row level security;
revoke all on public.scrape_runs from anon, authenticated;
