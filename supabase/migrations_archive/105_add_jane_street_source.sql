-- Jane Street Discover source: Greenhouse boards API with custom Employment Type / Duration metadata.

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
      'hudson_river_trading',
      'jane_street'
    )
  );

update public.companies
set
  is_active = true,
  industry = 'quant',
  careers_url = 'https://www.janestreet.com/join-jane-street/open-roles',
  updated_at = now()
where slug = 'jane-street';

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
    (select id from public.companies where slug = 'jane-street'),
    'jane_street',
    'jane-street-greenhouse',
    'https://www.janestreet.com/join-jane-street/open-roles',
    'janestreet',
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
