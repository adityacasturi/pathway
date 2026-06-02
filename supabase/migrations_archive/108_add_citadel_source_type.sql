-- Citadel Discover sources: WordPress Yoast career sitemap per brand (citadel.com / citadelsecurities.com).

alter table public.company_sources
  drop constraint if exists company_sources_source_type_check;

alter table public.company_sources
  add constraint company_sources_source_type_check
  check (
    source_type in (
      'ashby',
      'greenhouse',
      'lever',
      'workday',
      'nvidia',
      'microsoft',
      'google',
      'jane_street',
      'hudson_river_trading',
      'apple',
      'citadel'
    )
  );

insert into public.companies (slug, name, website_url, careers_url, industry)
values
  (
    'citadel',
    'Citadel',
    'https://www.citadel.com',
    'https://www.citadel.com/careers/open-opportunities',
    'quant'
  ),
  (
    'citadel-securities',
    'Citadel Securities',
    'https://www.citadelsecurities.com',
    'https://www.citadelsecurities.com/careers/open-opportunities',
    'quant'
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
    (select id from public.companies where slug = 'citadel'),
    'citadel',
    'citadel-career-sitemap',
    'https://www.citadel.com/careers/open-opportunities',
    'citadel',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'citadel-securities'),
    'citadel',
    'citadel-securities-career-sitemap',
    'https://www.citadelsecurities.com/careers/open-opportunities',
    'citadelsecurities',
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
