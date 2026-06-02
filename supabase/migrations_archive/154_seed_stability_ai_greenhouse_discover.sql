-- Stability AI Discover source: Greenhouse board stabilityai (verified May 2026).
-- Public API: boards-api.greenhouse.io/v1/boards/stabilityai/jobs

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'stability-ai',
  'Stability AI',
  'https://stability.ai',
  'https://stability.ai/careers',
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
    (select id from public.companies where slug = 'stability-ai'),
    'greenhouse',
    'stability-ai-greenhouse',
    'https://job-boards.greenhouse.io/stabilityai',
    'stabilityai',
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
