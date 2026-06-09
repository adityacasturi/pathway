-- Location confidence score + geocode resolution cache for batch normalization.

alter table public.scraped_postings
  add column if not exists location_confidence smallint;

comment on column public.scraped_postings.location_confidence is
  '0-100 confidence from geo resolution pipeline at scrape time.';

create table if not exists app_private.location_resolution_cache (
  raw_key text primary key,
  raw_label text not null,
  place jsonb not null,
  provider text not null,
  confidence smallint not null,
  resolved_at timestamptz not null default now()
);

comment on table app_private.location_resolution_cache is
  'Deduped geodata resolutions for messy ATS location strings (gazetteer, LocationIQ, manual).';

revoke all on table app_private.location_resolution_cache from public;
revoke all on table app_private.location_resolution_cache from anon;
revoke all on table app_private.location_resolution_cache from authenticated;
