-- BAE Systems Discover source: Phenom People (jobs.baesystems.com) + BrassRing apply (verified May 2026).
-- Workday myworkdayjobs probe failed; public search DDO at /global/en/search-results.
-- source_type bae_systems is added in 171_add_wayfair_discover.sql (constraint); this seeds catalog rows.

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'bae-systems',
  'BAE Systems',
  'https://www.baesystems.com',
  'https://jobs.baesystems.com/global/en/search-results',
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
    (select id from public.companies where slug = 'bae-systems'),
    'bae_systems',
    'bae-systems-phenom',
    'https://jobs.baesystems.com/global/en/search-results?keywords=intern',
    'BAE1US',
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
