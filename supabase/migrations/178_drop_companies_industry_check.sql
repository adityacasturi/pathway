-- Legacy enum check replaced by FK to public.discover_industries (see 177).
alter table public.companies drop constraint if exists companies_industry_check;
