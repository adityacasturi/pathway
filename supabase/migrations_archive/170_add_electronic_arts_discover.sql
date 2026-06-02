-- Electronic Arts Discover source: Avature careers portal at jobs.ea.com (portal 4; verified May 2026).
-- Greenhouse/Lever hints incorrect; public SearchJobs RSS + JobDetail pages.

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
      'shopify',
      'oracle',
      'morgan_stanley',
      'linkedin',
      'intuit',
      'netflix',
      'ibm',
      'coinbase',
      'citigroup',
      'rtx',
      'millennium',
      'lockheed_martin',
      'workable',
      'hiringthing',
      'surge',
      'smartrecruiters',
      'github',
      'splunk',
      'jobvite',
      'juniper_networks',
      'vmware',
      'sap',
      'seagate',
      'teradata',
      'l3harris',
      'chewy',
      'bae_systems',
      'electronic_arts',
      'etsy',
      'valve',
      'wayfair'
    )
  );

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'electronic-arts',
  'Electronic Arts',
  'https://www.ea.com',
  'https://jobs.ea.com/en_US/careers/SearchJobs',
  'gaming'
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
    (select id from public.companies where slug = 'electronic-arts'),
    'electronic_arts',
    'electronic-arts-avature',
    'https://jobs.ea.com/en_US/careers/SearchJobs',
    '4',
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
