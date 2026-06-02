-- VMware Discover source: Broadcom Workday External_Career with vmware-scoped search (May 2026).
-- Post-acquisition careers: broadcom.wd1.myworkdayjobs.com/External_Career

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
      'vmware'
    )
  );

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'vmware',
  'VMware',
  'https://www.vmware.com',
  'https://careers.vmware.com/',
  'cloud'
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
    (select id from public.companies where slug = 'vmware'),
    'vmware',
    'vmware-broadcom-workday',
    'https://broadcom.wd1.myworkdayjobs.com/en-US/External_Career',
    'External_Career',
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
