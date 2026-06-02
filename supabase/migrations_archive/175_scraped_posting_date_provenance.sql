-- Posted-date provenance for scraped_postings (publish vs modified vs inferred).

alter table public.scraped_postings
  add column if not exists date_modified timestamptz,
  add column if not exists date_posted_source text not null default 'unknown',
  add column if not exists date_posted_confidence text not null default 'unknown',
  add column if not exists date_posted_raw text;

alter table public.scraped_postings
  drop constraint if exists scraped_postings_date_posted_source_check;

alter table public.scraped_postings
  add constraint scraped_postings_date_posted_source_check
  check (date_posted_source in (
    'ats_publish',
    'ats_modified',
    'page',
    'sitemap',
    'relative_parse',
    'inferred',
    'unknown'
  ));

alter table public.scraped_postings
  drop constraint if exists scraped_postings_date_posted_confidence_check;

alter table public.scraped_postings
  add constraint scraped_postings_date_posted_confidence_check
  check (date_posted_confidence in ('high', 'medium', 'low', 'unknown'));

comment on column public.scraped_postings.date_posted is
  'Best estimate of employer publish time; merge policy keeps earliest publish-class value.';
comment on column public.scraped_postings.date_modified is
  'ATS last-touch time; never shown as Posted in the UI.';
comment on column public.scraped_postings.date_posted_source is
  'Provenance for date_posted (ats_publish, sitemap, relative_parse, etc.).';
comment on column public.scraped_postings.date_posted_confidence is
  'Trust level for showing Posted in the UI (high/medium/low/unknown).';

-- Conservative backfill: relabel known-bad patterns without nulling sortable dates.
update public.scraped_postings sp
set
  date_posted_source = 'ats_modified',
  date_posted_confidence = 'low'
from public.companies c
join public.company_sources cs on cs.company_id = c.id
where sp.company_id = c.id
  and sp.date_posted is not null
  and sp.date_posted_source = 'unknown'
  and cs.source_type in ('greenhouse', 'jane_street', 'coinbase', 'atlassian', 'lockheed_martin');

update public.scraped_postings sp
set
  date_posted_source = 'sitemap',
  date_posted_confidence = 'low'
from public.companies c
join public.company_sources cs on cs.company_id = c.id
where sp.company_id = c.id
  and sp.date_posted is not null
  and sp.date_posted_source = 'unknown'
  and cs.source_type = 'citadel';
