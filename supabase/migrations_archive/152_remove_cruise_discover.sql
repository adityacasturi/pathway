-- Cruise shut down; remove company, sources, and scraped postings from Discover.

delete from public.scraped_postings
where company_id in (select id from public.companies where slug = 'cruise');

delete from public.company_sources
where company_id in (select id from public.companies where slug = 'cruise');

delete from public.companies
where slug = 'cruise';

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
      'github'
    )
  );
