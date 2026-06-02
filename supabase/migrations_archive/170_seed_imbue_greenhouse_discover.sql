-- Imbue Discover source: Greenhouse board token imbue (verified May 2026).
-- boards-api.greenhouse.io/v1/boards/imbue/jobs returns HTTP 200.

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'imbue',
  'Imbue',
  'https://imbue.com',
  'https://job-boards.greenhouse.io/imbue',
  'ai'
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
    (select id from public.companies where slug = 'imbue'),
    'greenhouse',
    'imbue-greenhouse',
    'https://job-boards.greenhouse.io/imbue',
    'imbue',
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
