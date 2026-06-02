-- Additional Discover companies (Greenhouse + Ashby). Board tokens verified via public APIs (May 2026).

insert into public.companies (slug, name, website_url, careers_url, industry)
values
  ('xai', 'xAI', 'https://x.ai', 'https://x.ai/careers', 'ai'),
  ('fal', 'Fal', 'https://fal.ai', 'https://fal.ai/careers', 'ai'),
  ('runpod', 'Runpod', 'https://www.runpod.io', 'https://www.runpod.io/careers', 'ai'),
  ('benchling', 'Benchling', 'https://www.benchling.com', 'https://www.benchling.com/careers', 'ai'),
  ('jetbrains', 'JetBrains', 'https://www.jetbrains.com', 'https://www.jetbrains.com/careers', 'devtools'),
  ('clickhouse', 'ClickHouse', 'https://clickhouse.com', 'https://clickhouse.com/company/careers', 'devtools'),
  ('fivetran', 'Fivetran', 'https://www.fivetran.com', 'https://www.fivetran.com/careers', 'devtools'),
  ('confluent', 'Confluent', 'https://www.confluent.io', 'https://careers.confluent.io', 'devtools'),
  ('sentry', 'Sentry', 'https://sentry.io', 'https://sentry.io/careers', 'devtools'),
  ('hex-technologies', 'Hex', 'https://hex.tech', 'https://hex.tech/careers', 'devtools'),
  ('monzo', 'Monzo', 'https://monzo.com', 'https://monzo.com/careers', 'fintech'),
  ('n26', 'N26', 'https://n26.com', 'https://n26.com/en-eu/careers', 'fintech'),
  ('epic-games', 'Epic Games', 'https://www.epicgames.com', 'https://www.epicgames.com/site/en-US/careers', 'consumer'),
  ('unity', 'Unity', 'https://unity.com', 'https://unity.com/careers', 'consumer'),
  ('intercom', 'Intercom', 'https://www.intercom.com', 'https://www.intercom.com/careers', 'enterprise'),
  ('spacex', 'SpaceX', 'https://www.spacex.com', 'https://www.spacex.com/careers', 'mobility')
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
  ((select id from public.companies where slug = 'xai'), 'greenhouse', 'xai-greenhouse', 'https://job-boards.greenhouse.io/xai', 'xai', true, 240),
  ((select id from public.companies where slug = 'fal'), 'greenhouse', 'fal-greenhouse', 'https://job-boards.greenhouse.io/fal', 'fal', true, 240),
  ((select id from public.companies where slug = 'runpod'), 'ashby', 'runpod-ashby', 'https://jobs.ashbyhq.com/runpod', 'runpod', true, 240),
  ((select id from public.companies where slug = 'benchling'), 'ashby', 'benchling-ashby', 'https://jobs.ashbyhq.com/benchling', 'benchling', true, 240),
  ((select id from public.companies where slug = 'jetbrains'), 'greenhouse', 'jetbrains-greenhouse', 'https://job-boards.greenhouse.io/jetbrains', 'jetbrains', true, 240),
  ((select id from public.companies where slug = 'clickhouse'), 'greenhouse', 'clickhouse-greenhouse', 'https://job-boards.greenhouse.io/clickhouse', 'clickhouse', true, 240),
  ((select id from public.companies where slug = 'fivetran'), 'greenhouse', 'fivetran-greenhouse', 'https://job-boards.greenhouse.io/fivetran', 'fivetran', true, 240),
  ((select id from public.companies where slug = 'confluent'), 'ashby', 'confluent-ashby', 'https://jobs.ashbyhq.com/confluent', 'confluent', true, 240),
  ((select id from public.companies where slug = 'sentry'), 'ashby', 'sentry-ashby', 'https://jobs.ashbyhq.com/sentry', 'sentry', true, 240),
  ((select id from public.companies where slug = 'hex-technologies'), 'greenhouse', 'hex-technologies-greenhouse', 'https://job-boards.greenhouse.io/hextechnologies', 'hextechnologies', true, 240),
  ((select id from public.companies where slug = 'monzo'), 'greenhouse', 'monzo-greenhouse', 'https://job-boards.greenhouse.io/monzo', 'monzo', true, 240),
  ((select id from public.companies where slug = 'n26'), 'greenhouse', 'n26-greenhouse', 'https://job-boards.greenhouse.io/n26', 'n26', true, 240),
  ((select id from public.companies where slug = 'epic-games'), 'greenhouse', 'epic-games-greenhouse', 'https://job-boards.greenhouse.io/epicgames', 'epicgames', true, 240),
  ((select id from public.companies where slug = 'unity'), 'greenhouse', 'unity-greenhouse', 'https://job-boards.greenhouse.io/unity3d', 'unity3d', true, 240),
  ((select id from public.companies where slug = 'intercom'), 'greenhouse', 'intercom-greenhouse', 'https://job-boards.greenhouse.io/intercom', 'intercom', true, 240),
  ((select id from public.companies where slug = 'spacex'), 'greenhouse', 'spacex-greenhouse', 'https://job-boards.greenhouse.io/spacex', 'spacex', true, 240)
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
