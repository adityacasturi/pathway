-- Netflix Discover source: Phenom/Eightfold (explore.jobs.netflix.net). Lever board is empty (migration 092).

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
      'linkedin',
      'intuit',
      'shopify',
      'netflix'
    )
  );

update public.companies
set
  careers_url = 'https://explore.jobs.netflix.net/careers',
  is_active = true,
  updated_at = now()
where slug = 'netflix';

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
    (select id from public.companies where slug = 'netflix'),
    'netflix',
    'netflix-phenom',
    'https://explore.jobs.netflix.net/careers?query=intern',
    'netflix.com',
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
