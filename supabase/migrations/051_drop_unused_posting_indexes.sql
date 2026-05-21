-- Migration 051: Drop currently-unused posting store indexes flagged by advisors.
-- These can be reintroduced if/when query patterns prove they are needed.

drop index if exists public.company_sources_enabled_idx;
drop index if exists public.postings_company_status_idx;
drop index if exists public.postings_date_posted_idx;
drop index if exists public.postings_season_idx;
drop index if exists public.postings_locations_gin_idx;
drop index if exists public.postings_countries_gin_idx;
drop index if exists public.posting_source_observations_posting_idx;
drop index if exists public.posting_source_observations_last_seen_idx;
drop index if exists public.posting_source_observations_company_idx;
