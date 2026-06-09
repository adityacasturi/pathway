-- Structured canonical locations for scraped postings (city, region, country_code).
alter table public.scraped_postings
  add column if not exists location_places jsonb;

comment on column public.scraped_postings.location_places is
  'Canonical place list from scrape normalization: [{city, region, country_code, remote}].';
