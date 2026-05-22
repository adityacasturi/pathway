-- Databricks Greenhouse source

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  (
    'databricks',
    'Databricks',
    'https://boards.greenhouse.io/databricks',
    'https://boards.greenhouse.io/databricks',
    40
  )
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
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
    (select id from public.companies where slug = 'databricks'),
    'greenhouse',
    'databricks-greenhouse',
    'https://boards.greenhouse.io/databricks',
    'databricks',
    true,
    180
  );
