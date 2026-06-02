-- Leidos Discover source: Workday CXS External site (verified May 2026).
-- CXS: leidos.wd5.myworkdayjobs.com/wday/cxs/leidos/External/jobs

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'leidos',
  'Leidos',
  'https://www.leidos.com',
  'https://leidos.wd5.myworkdayjobs.com/External',
  'aerospace'
)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  industry = coalesce(public.companies.industry, excluded.industry),
  is_active = true,
  updated_at = now();

insert into public.company_sources (
  company_id,
  source_type,
  adapter_key,
  source_url,
  board_token,
  enabled,
  scrape_interval_minutes
)
values
  (
    (select id from public.companies where slug = 'leidos'),
    'workday',
    'leidos-workday',
    'https://leidos.wd5.myworkdayjobs.com/en-US/External',
    'External',
    true,
    240
  )
on conflict (
  company_id,
  source_type,
  adapter_key,
  coalesce(board_token, ''),
  coalesce(source_url, '')
) do update set
  source_url = excluded.source_url,
  board_token = excluded.board_token,
  enabled = true,
  last_error_code = null,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();
