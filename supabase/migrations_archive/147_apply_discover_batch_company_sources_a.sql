-- Discover batch company_sources (enabled set, part A). Applied remotely May 2026.

insert into public.company_sources (company_id, source_type, adapter_key, source_url, board_token, enabled, scrape_interval_minutes)
values
  ((select id from public.companies where slug = 'blue-origin'), 'workday', 'blue-origin-workday', 'https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin', 'BlueOrigin', true, 240),
  ((select id from public.companies where slug = 'radix-trading'), 'greenhouse', 'radix-trading-greenhouse', 'https://job-boards.greenhouse.io/radixuniversity', 'radixuniversity', true, 240),
  ((select id from public.companies where slug = 'voloridge'), 'hiringthing', 'voloridge-hiringthing', 'https://voloridge-investment-management.hiringthing.com/', 'voloridge-investment-management', true, 240),
  ((select id from public.companies where slug = 'chicago-trading-company'), 'greenhouse', 'chicago-trading-company-greenhouse', 'https://job-boards.greenhouse.io/chicagotrading', 'chicagotrading', true, 240),
  ((select id from public.companies where slug = 'verkada'), 'greenhouse', 'verkada-greenhouse', 'https://job-boards.greenhouse.io/verkada', 'verkada', true, 240),
  ((select id from public.companies where slug = 'varda-space'), 'greenhouse', 'varda-space-greenhouse', 'https://job-boards.greenhouse.io/vardaspace', 'vardaspace', true, 240),
  ((select id from public.companies where slug = 'shield-ai'), 'lever', 'shield-ai-lever', 'https://jobs.lever.co/shieldai', 'shieldai', true, 240),
  ((select id from public.companies where slug = 'figure-ai'), 'greenhouse', 'figure-ai-greenhouse', 'https://job-boards.greenhouse.io/figureai', 'figureai', true, 240),
  ((select id from public.companies where slug = 'hugging-face'), 'workable', 'hugging-face-workable', 'https://apply.workable.com/huggingface', 'huggingface', true, 240),
  ((select id from public.companies where slug = 'wiz'), 'greenhouse', 'wiz-greenhouse', 'https://job-boards.greenhouse.io/wizinc', 'wizinc', true, 240)
on conflict (company_id, source_type, adapter_key, coalesce(board_token, ''), coalesce(source_url, ''))
do update set
  source_url = excluded.source_url,
  board_token = excluded.board_token,
  enabled = excluded.enabled,
  last_error_code = case when excluded.enabled then null else public.company_sources.last_error_code end,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();
