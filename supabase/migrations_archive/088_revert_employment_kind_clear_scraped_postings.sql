-- Revert employment_kind experiment and clear scraped postings for a clean rescrape.

delete from public.scraped_postings;

drop index if exists public.scraped_postings_company_employment_status_idx;

alter table public.scraped_postings
  drop constraint if exists scraped_postings_employment_kind_check;

alter table public.scraped_postings
  drop column if exists employment_kind;
