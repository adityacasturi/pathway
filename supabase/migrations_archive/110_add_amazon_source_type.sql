-- Amazon Discover source: amazon.jobs public search.json API (migration 061 used custom).

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
      'amazon'
    )
  );

update public.company_sources
set
  source_type = 'amazon',
  board_token = coalesce(nullif(btrim(board_token), ''), 'en'),
  source_url = coalesce(nullif(btrim(source_url), ''), 'https://www.amazon.jobs'),
  enabled = true,
  last_error_code = null,
  updated_at = now()
where company_id = (select id from public.companies where slug = 'amazon')
  and adapter_key = 'amazon-jobs';

insert into public.company_sources (
  company_id,
  source_type,
  adapter_key,
  source_url,
  board_token,
  enabled,
  scrape_interval_minutes
)
select
  c.id,
  'amazon',
  'amazon-jobs',
  'https://www.amazon.jobs',
  'en',
  true,
  180
from public.companies c
where c.slug = 'amazon'
  and not exists (
    select 1
    from public.company_sources cs
    where cs.company_id = c.id
      and cs.source_type = 'amazon'
      and cs.adapter_key = 'amazon-jobs'
  );
