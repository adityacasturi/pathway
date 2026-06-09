-- Allow first_scraped as date_posted_source for new posting inserts (posted = first scrape time).

alter table public.scraped_postings
  drop constraint if exists scraped_postings_date_posted_source_check;

alter table public.scraped_postings
  add constraint scraped_postings_date_posted_source_check
  check (date_posted_source = any (array[
    'ats_publish'::text,
    'ats_modified'::text,
    'page'::text,
    'sitemap'::text,
    'relative_parse'::text,
    'inferred'::text,
    'unknown'::text,
    'first_scraped'::text
  ]));
