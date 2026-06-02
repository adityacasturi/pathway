-- Quant & trading firms with verified public Greenhouse boards (May 2026).

insert into public.companies (slug, name, website_url, careers_url, priority, industry)
values
  (
    'aquatic-capital',
    'Aquatic Capital',
    'https://www.aquatic.com',
    'https://job-boards.greenhouse.io/aquaticcapitalmanagement',
    123,
    'quant'
  ),
  (
    'jump-trading',
    'Jump Trading',
    'https://www.jumptrading.com',
    'https://www.jumptrading.com/careers',
    113,
    'quant'
  ),
  (
    'drw',
    'DRW',
    'https://drw.com',
    'https://drw.com/careers',
    114,
    'quant'
  ),
  (
    'imc',
    'IMC',
    'https://www.imc.com',
    'https://www.imc.com/careers',
    115,
    'quant'
  ),
  (
    'akuna-capital',
    'Akuna Capital',
    'https://www.akunacapital.com',
    'https://www.akunacapital.com/careers',
    116,
    'quant'
  ),
  (
    'aqr',
    'AQR Capital Management',
    'https://www.aqr.com',
    'https://careers.aqr.com',
    117,
    'quant'
  ),
  (
    'worldquant',
    'WorldQuant',
    'https://www.worldquant.com',
    'https://www.worldquant.com/careers',
    118,
    'quant'
  ),
  (
    'point72',
    'Point72',
    'https://point72.com',
    'https://careers.point72.com',
    119,
    'quant'
  ),
  (
    'virtu',
    'Virtu Financial',
    'https://www.virtu.com',
    'https://www.virtu.com/careers',
    120,
    'quant'
  ),
  (
    'flow-traders',
    'Flow Traders',
    'https://www.flowtraders.com',
    'https://www.flowtraders.com/careers',
    121,
    'quant'
  ),
  (
    'schonfeld',
    'Schonfeld',
    'https://schonfeld.com',
    'https://schonfeld.com/careers',
    122,
    'quant'
  )
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
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
    (select id from public.companies where slug = 'aquatic-capital'),
    'greenhouse',
    'aquatic-capital-greenhouse',
    'https://job-boards.greenhouse.io/aquaticcapitalmanagement',
    'aquaticcapitalmanagement',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'jump-trading'),
    'greenhouse',
    'jump-trading-greenhouse',
    'https://job-boards.greenhouse.io/jumptrading',
    'jumptrading',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'drw'),
    'greenhouse',
    'drw-greenhouse',
    'https://job-boards.greenhouse.io/drweng',
    'drweng',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'imc'),
    'greenhouse',
    'imc-greenhouse',
    'https://job-boards.greenhouse.io/imc',
    'imc',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'akuna-capital'),
    'greenhouse',
    'akuna-capital-greenhouse',
    'https://job-boards.greenhouse.io/akunacapital',
    'akunacapital',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'aqr'),
    'greenhouse',
    'aqr-greenhouse',
    'https://job-boards.greenhouse.io/aqr',
    'aqr',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'worldquant'),
    'greenhouse',
    'worldquant-greenhouse',
    'https://job-boards.greenhouse.io/worldquant',
    'worldquant',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'point72'),
    'greenhouse',
    'point72-greenhouse',
    'https://job-boards.greenhouse.io/point72',
    'point72',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'virtu'),
    'greenhouse',
    'virtu-greenhouse',
    'https://job-boards.greenhouse.io/virtu',
    'virtu',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'flow-traders'),
    'greenhouse',
    'flow-traders-greenhouse',
    'https://job-boards.greenhouse.io/flowtraders',
    'flowtraders',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'schonfeld'),
    'greenhouse',
    'schonfeld-greenhouse',
    'https://job-boards.greenhouse.io/schonfeld',
    'schonfeld',
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
