-- Grubhub Discover source: Wonder Group Workday Grubhub_Careers (verified May 2026).
-- CXS: wonder.wd1.myworkdayjobs.com/wday/cxs/wonder/Grubhub_Careers/jobs

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'grubhub',
  'Grubhub',
  'https://www.grubhub.com',
  'https://wonder.wd1.myworkdayjobs.com/Grubhub_Careers',
  'consumer'
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
    (select id from public.companies where slug = 'grubhub'),
    'workday',
    'grubhub-workday',
    'https://wonder.wd1.myworkdayjobs.com/en-US/Grubhub_Careers',
    'Grubhub_Careers',
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
