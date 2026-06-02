-- Adept AI Discover source: SmartRecruiters public API (company id Adept, May 2026).
-- GH/Ashby boards removed post-acquihire; API returns empty list but remains stable.

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'adept-ai',
  'Adept AI',
  'https://www.adept.ai',
  'https://www.adept.ai/about-careers/',
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
    (select id from public.companies where slug = 'adept-ai'),
    'smartrecruiters',
    'adept-ai-smartrecruiters',
    'https://careers.smartrecruiters.com/Adept',
    'Adept',
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
