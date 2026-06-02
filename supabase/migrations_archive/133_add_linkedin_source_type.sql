-- LinkedIn Discover source: public linkedin.com/jobs search + guest job posting API.
-- careers.linkedin.com routes candidates to LinkedIn Jobs (company IDs in board_token).

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
      'citadel',
      'two_sigma',
      'amazon',
      'meta',
      'qualcomm',
      'uber',
      'salesforce',
      'de_shaw',
      'tesla',
      'amd',
      'bytedance',
      'atlassian',
      'tower_research',
      'sig',
      'rivian',
      'five_rings',
      'jpmorgan_chase',
      'bloomberg',
      'goldman_sachs',
      'oracle',
      'morgan_stanley',
      'linkedin'
    )
  );

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'linkedin',
  'LinkedIn',
  'https://www.linkedin.com',
  'https://careers.linkedin.com/',
  'big-tech'
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
    (select id from public.companies where slug = 'linkedin'),
    'linkedin',
    'linkedin-jobs-guest',
    'https://www.linkedin.com/jobs/search/?f_C=1337,9202023,2561065,2587638,290903,39939&location=United%20States',
    '1337,9202023,2561065,2587638,290903,39939',
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
