-- Akamai Discover source: Oracle Fusion CE at fa-extu-saasfaprod1 (site CX_1, vanity jobs.akamai.com).

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'akamai',
  'Akamai',
  'https://www.akamai.com',
  'https://jobs.akamai.com',
  'security'
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
    (select id from public.companies where slug = 'akamai'),
    'oracle',
    'akamai-oracle-ce',
    'https://jobs.akamai.com/en/sites/CX_1',
    'CX_1',
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
