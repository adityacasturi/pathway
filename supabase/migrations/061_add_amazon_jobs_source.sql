-- Wire Amazon to amazon.jobs search API (not Greenhouse/Lever).

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
    (select id from public.companies where slug = 'amazon'),
    'custom',
    'amazon-jobs',
    'https://www.amazon.jobs',
    null,
    true,
    180
  )
on conflict (company_id, source_type, adapter_key, coalesce(board_token, ''), coalesce(source_url, '')) do update set
  enabled = true,
  scrape_interval_minutes = 180,
  updated_at = now();
