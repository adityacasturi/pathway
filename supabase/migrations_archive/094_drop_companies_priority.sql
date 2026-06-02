-- Discover and scrape ordering use company name; priority is no longer needed.

drop index if exists public.companies_industry_priority_idx;

alter table public.companies
  drop column if exists priority;
