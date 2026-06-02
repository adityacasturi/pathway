-- Seed prestigious Discover companies (Greenhouse, Ashby, Lever).
-- Skips Coinbase and Plaid — public Greenhouse boards return 404 (see migration 053).

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  ('anthropic', 'Anthropic', 'https://www.anthropic.com', 'https://www.anthropic.com/jobs', 3),
  ('openai', 'OpenAI', 'https://openai.com', 'https://openai.com/careers', 4),
  ('figma', 'Figma', 'https://www.figma.com', 'https://www.figma.com/careers', 5),
  ('airbnb', 'Airbnb', 'https://www.airbnb.com', 'https://careers.airbnb.com', 6),
  ('notion', 'Notion', 'https://www.notion.so', 'https://www.notion.so/careers', 7),
  ('datadog', 'Datadog', 'https://www.datadoghq.com', 'https://careers.datadoghq.com', 8),
  ('discord', 'Discord', 'https://discord.com', 'https://discord.com/careers', 9),
  ('dropbox', 'Dropbox', 'https://www.dropbox.com', 'https://www.dropbox.com/jobs', 10),
  ('palantir', 'Palantir', 'https://www.palantir.com', 'https://www.palantir.com/careers', 11),
  ('spotify', 'Spotify', 'https://www.spotify.com', 'https://www.lifeatspotify.com/jobs', 12),
  ('vercel', 'Vercel', 'https://vercel.com', 'https://vercel.com/careers', 13),
  ('robinhood', 'Robinhood', 'https://robinhood.com', 'https://careers.robinhood.com', 14),
  ('linear', 'Linear', 'https://linear.app', 'https://linear.app/careers', 15),
  ('perplexity', 'Perplexity', 'https://www.perplexity.ai', 'https://www.perplexity.ai/hub/careers', 16)
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
    (select id from public.companies where slug = 'anthropic'),
    'greenhouse',
    'anthropic-greenhouse',
    'https://boards.greenhouse.io/anthropic',
    'anthropic',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'figma'),
    'greenhouse',
    'figma-greenhouse',
    'https://boards.greenhouse.io/figma',
    'figma',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'airbnb'),
    'greenhouse',
    'airbnb-greenhouse',
    'https://boards.greenhouse.io/airbnb',
    'airbnb',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'datadog'),
    'greenhouse',
    'datadog-greenhouse',
    'https://boards.greenhouse.io/datadog',
    'datadog',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'discord'),
    'greenhouse',
    'discord-greenhouse',
    'https://boards.greenhouse.io/discord',
    'discord',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'dropbox'),
    'greenhouse',
    'dropbox-greenhouse',
    'https://boards.greenhouse.io/dropbox',
    'dropbox',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'robinhood'),
    'greenhouse',
    'robinhood-greenhouse',
    'https://boards.greenhouse.io/robinhood',
    'robinhood',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'openai'),
    'ashby',
    'openai-ashby',
    'https://jobs.ashbyhq.com/openai',
    'openai',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'notion'),
    'ashby',
    'notion-ashby',
    'https://jobs.ashbyhq.com/notion',
    'notion',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'vercel'),
    'ashby',
    'vercel-ashby',
    'https://jobs.ashbyhq.com/vercel',
    'vercel',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'linear'),
    'ashby',
    'linear-ashby',
    'https://jobs.ashbyhq.com/linear',
    'linear',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'perplexity'),
    'ashby',
    'perplexity-ashby',
    'https://jobs.ashbyhq.com/perplexity',
    'perplexity',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'palantir'),
    'lever',
    'palantir-lever',
    'https://jobs.lever.co/palantir',
    'palantir',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'spotify'),
    'lever',
    'spotify-lever',
    'https://jobs.lever.co/spotify',
    'spotify',
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
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();
