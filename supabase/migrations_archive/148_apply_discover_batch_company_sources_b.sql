-- Discover batch company_sources (enabled set part B + disabled placeholders). Applied remotely May 2026.

insert into public.company_sources (company_id, source_type, adapter_key, source_url, board_token, enabled, scrape_interval_minutes)
values
  ((select id from public.companies where slug = 'labelbox'), 'greenhouse', 'labelbox-greenhouse', 'https://job-boards.greenhouse.io/labelbox', 'labelbox', true, 240),
  ((select id from public.companies where slug = 'snorkel-ai'), 'greenhouse', 'snorkel-ai-greenhouse', 'https://job-boards.greenhouse.io/snorkelai', 'snorkelai', true, 240),
  ((select id from public.companies where slug = 'surge-ai'), 'surge', 'surge-ai-careers', 'https://www.surgehq.ai/careers', 'careers', true, 240),
  ((select id from public.companies where slug = 'xtx-markets'), 'greenhouse', 'xtx-markets-greenhouse', 'https://job-boards.greenhouse.io/xtxmarketstechnologies', 'xtxmarketstechnologies', true, 240),
  ((select id from public.companies where slug = 'hermeus'), 'lever', 'hermeus-lever', 'https://jobs.lever.co/hermeus', 'hermeus', true, 240),
  ((select id from public.companies where slug = 'planet-labs'), 'greenhouse', 'planet-labs-greenhouse', 'https://job-boards.greenhouse.io/planetlabs', 'planetlabs', true, 240),
  ((select id from public.companies where slug = 'cerebras'), 'greenhouse', 'cerebras-greenhouse', 'https://job-boards.greenhouse.io/cerebrassystems', 'cerebrassystems', true, 240),
  ((select id from public.companies where slug = 'dbt-labs'), 'greenhouse', 'dbt-labs-greenhouse', 'https://job-boards.greenhouse.io/dbtlabsinc', 'dbtlabsinc', true, 240),
  ((select id from public.companies where slug = 'zoom'), 'workday', 'zoom-workday', 'https://zoom.wd5.myworkdayjobs.com/en-US/Zoom', 'Zoom', true, 240),
  ((select id from public.companies where slug = 'groq'), 'greenhouse', 'groq-greenhouse', 'https://job-boards.greenhouse.io/groq', 'groq', false, 240),
  ((select id from public.companies where slug = 'balyasny'), 'greenhouse', 'balyasny-greenhouse', 'https://job-boards.greenhouse.io/balyasny', 'balyasny', false, 240),
  ((select id from public.companies where slug = 'headlands-technology'), 'greenhouse', 'headlands-technology-greenhouse', 'https://job-boards.greenhouse.io/headlandstechnology', 'headlandstechnology', false, 240),
  ((select id from public.companies where slug = 'hashicorp'), 'greenhouse', 'hashicorp-greenhouse', 'https://job-boards.greenhouse.io/hashicorp', 'hashicorp', false, 240),
  ((select id from public.companies where slug = 'sentinelone'), 'greenhouse', 'sentinelone-greenhouse', 'https://job-boards.greenhouse.io/sentinelone', 'sentinelone', false, 240),
  ((select id from public.companies where slug = 'retool'), 'greenhouse', 'retool-greenhouse', 'https://job-boards.greenhouse.io/retool', 'retool', false, 240),
  ((select id from public.companies where slug = 'joby-aviation'), 'greenhouse', 'joby-aviation-greenhouse', 'https://job-boards.greenhouse.io/joby', 'joby', false, 240)
on conflict (company_id, source_type, adapter_key, coalesce(board_token, ''), coalesce(source_url, ''))
do update set
  source_url = excluded.source_url,
  board_token = excluded.board_token,
  enabled = excluded.enabled,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();

update public.company_sources
set
  last_error_code = 'no_public_job_feed',
  updated_at = now()
where adapter_key in (
  'groq-greenhouse',
  'balyasny-greenhouse',
  'headlands-technology-greenhouse',
  'hashicorp-greenhouse',
  'sentinelone-greenhouse',
  'retool-greenhouse',
  'joby-aviation-greenhouse'
)
  and enabled = false;
