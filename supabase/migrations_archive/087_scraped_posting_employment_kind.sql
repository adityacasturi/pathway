-- Track internship vs full-time on Discover scraped roles.

alter table public.scraped_postings
  add column employment_kind text;

update public.scraped_postings
set employment_kind = case
  when role_name ~* '\bintern(?:ship)?\b|\bco-?op\b' then 'internship'
  else 'full_time'
end
where employment_kind is null;

alter table public.scraped_postings
  alter column employment_kind set default 'full_time',
  alter column employment_kind set not null;

alter table public.scraped_postings
  add constraint scraped_postings_employment_kind_check
  check (employment_kind in ('internship', 'full_time'));

create index scraped_postings_company_employment_status_idx
  on public.scraped_postings (company_id, employment_kind, status);
