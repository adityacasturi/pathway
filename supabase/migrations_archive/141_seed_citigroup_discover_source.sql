-- Seed Citigroup Discover company + TalentBrew source (source_type added in 140_add_rtx_source_type).

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'citigroup',
  'Citigroup',
  'https://www.citigroup.com',
  'https://jobs.citi.com',
  'finance'
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
    (select id from public.companies where slug = 'citigroup'),
    'citigroup',
    'citigroup-talentbrew',
    'https://jobs.citi.com/search-jobs?k=intern&l=&listFilterMode=1',
    'intern',
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
