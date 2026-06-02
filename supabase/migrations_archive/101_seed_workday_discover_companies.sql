-- Seed Workday-backed Discover companies (CXS API verified May 2026).

insert into public.companies (slug, name, website_url, careers_url, industry)
values
  (
    'autodesk',
    'Autodesk',
    'https://www.autodesk.com',
    'https://autodesk.wd1.myworkdayjobs.com/en-US/Ext',
    'devtools'
  ),
  (
    'boeing',
    'Boeing',
    'https://www.boeing.com',
    'https://boeing.wd1.myworkdayjobs.com/en-US/EXTERNAL_CAREERS',
    'mobility'
  ),
  (
    'capital-one',
    'Capital One',
    'https://www.capitalone.com',
    'https://capitalone.wd12.myworkdayjobs.com/en-US/Capital_One',
    'fintech'
  ),
  (
    'cisco',
    'Cisco',
    'https://www.cisco.com',
    'https://cisco.wd5.myworkdayjobs.com/en-US/Cisco_Careers',
    'devtools'
  ),
  (
    'micron',
    'Micron',
    'https://www.micron.com',
    'https://micron.wd1.myworkdayjobs.com/en-US/External',
    'devtools'
  ),
  (
    'palo-alto-networks',
    'Palo Alto Networks',
    'https://www.paloaltonetworks.com',
    'https://paloaltonetworks.wd5.myworkdayjobs.com/en-US/panwexternalcareers',
    'security'
  ),
  (
    'visa',
    'Visa',
    'https://www.visa.com',
    'https://visa.wd5.myworkdayjobs.com/en-US/Visa',
    'fintech'
  ),
  (
    'workday',
    'Workday',
    'https://www.workday.com',
    'https://workday.wd5.myworkdayjobs.com/en-US/Workday',
    'enterprise'
  )
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  industry = excluded.industry,
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
    (select id from public.companies where slug = 'autodesk'),
    'workday',
    'autodesk-workday',
    'https://autodesk.wd1.myworkdayjobs.com/en-US/Ext',
    'Ext',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'boeing'),
    'workday',
    'boeing-workday',
    'https://boeing.wd1.myworkdayjobs.com/en-US/EXTERNAL_CAREERS',
    'EXTERNAL_CAREERS',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'capital-one'),
    'workday',
    'capital-one-workday',
    'https://capitalone.wd12.myworkdayjobs.com/en-US/Capital_One',
    'Capital_One',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'cisco'),
    'workday',
    'cisco-workday',
    'https://cisco.wd5.myworkdayjobs.com/en-US/Cisco_Careers',
    'Cisco_Careers',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'micron'),
    'workday',
    'micron-workday',
    'https://micron.wd1.myworkdayjobs.com/en-US/External',
    'External',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'palo-alto-networks'),
    'workday',
    'palo-alto-networks-workday',
    'https://paloaltonetworks.wd5.myworkdayjobs.com/en-US/panwexternalcareers',
    'panwexternalcareers',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'visa'),
    'workday',
    'visa-workday',
    'https://visa.wd5.myworkdayjobs.com/en-US/Visa',
    'Visa',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'workday'),
    'workday',
    'workday-workday',
    'https://workday.wd5.myworkdayjobs.com/en-US/Workday',
    'Workday',
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
