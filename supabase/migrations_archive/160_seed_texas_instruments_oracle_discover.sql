-- Texas Instruments Discover source: Oracle Fusion CE at edbz.fa.us2 (site CX, verified May 2026).
-- Inbox hint workday was incorrect; public API: edbz.fa.us2.oraclecloud.com/hcmRestApi/.../siteNumber=CX

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'texas-instruments',
  'Texas Instruments',
  'https://www.ti.com',
  'https://careers.ti.com',
  'semiconductor'
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
    (select id from public.companies where slug = 'texas-instruments'),
    'oracle',
    'texas-instruments-oracle-ce',
    'https://edbz.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
    'CX',
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
