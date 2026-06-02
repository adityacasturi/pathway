-- Coinbase Discover source: public careers API (api.coinbase.com/v2/careers) + Greenhouse embed metadata.

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
      'coinbase'
    )
  );

update public.companies
set
  is_active = true,
  industry = coalesce(industry, 'crypto'),
  careers_url = 'https://www.coinbase.com/careers/positions',
  updated_at = now()
where slug = 'coinbase';

update public.company_sources
set
  enabled = false,
  last_error_code = 'superseded_by_coinbase_careers_api',
  updated_at = now()
where adapter_key = 'coinbase-greenhouse';

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
    (select id from public.companies where slug = 'coinbase'),
    'coinbase',
    'coinbase-careers-api',
    'https://www.coinbase.com/careers/positions',
    'coinbase',
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
