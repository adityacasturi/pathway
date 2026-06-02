-- Northrop Grumman Discover source: Workday CXS Northrop_Grumman_External_Site (verified May 2026).
-- CXS: ngc.wd1.myworkdayjobs.com/wday/cxs/ngc/Northrop_Grumman_External_Site/jobs

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'northrop-grumman',
  'Northrop Grumman',
  'https://www.northropgrumman.com',
  'https://ngc.wd1.myworkdayjobs.com/Northrop_Grumman_External_Site',
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
    (select id from public.companies where slug = 'northrop-grumman'),
    'workday',
    'northrop-grumman-workday',
    'https://ngc.wd1.myworkdayjobs.com/en-US/Northrop_Grumman_External_Site',
    'Northrop_Grumman_External_Site',
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
