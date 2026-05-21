-- Wire Optiver to its Greenhouse board (embed token optiverus, not company slug optiver).

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  (
    'optiver',
    'Optiver',
    'https://optiver.com',
    'https://optiver.com/working-at-optiver/career-opportunities',
    7
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
    (select id from public.companies where slug = 'optiver'),
    'greenhouse',
    'optiver-greenhouse',
    'https://job-boards.greenhouse.io/optiverus',
    'optiverus',
    true,
    180
  );
