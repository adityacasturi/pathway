-- Workday CXS adapter (myworkdayjobs.com public JSON API).

alter table public.company_sources
  drop constraint if exists company_sources_source_type_check;

alter table public.company_sources
  add constraint company_sources_source_type_check
  check (source_type in ('ashby', 'greenhouse', 'lever', 'workday'));

insert into public.companies (slug, name, website_url, careers_url, industry)
values
  ('adobe', 'Adobe', 'https://www.adobe.com', 'https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced', 'devtools'),
  ('intel', 'Intel', 'https://www.intel.com', 'https://intel.wd1.myworkdayjobs.com/en-US/External', 'devtools')
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
    (select id from public.companies where slug = 'adobe'),
    'workday',
    'adobe-workday',
    'https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced',
    'external_experienced',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'intel'),
    'workday',
    'intel-workday',
    'https://intel.wd1.myworkdayjobs.com/en-US/External',
    'External',
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
