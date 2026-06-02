-- Expand Discover company catalog (Greenhouse, Ashby, Lever).
-- Skips Coinbase and Plaid — public Greenhouse boards return 404 (migration 082).

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  ('reddit', 'Reddit', 'https://www.redditinc.com', 'https://www.redditinc.com/careers', 17),
  ('asana', 'Asana', 'https://asana.com', 'https://asana.com/jobs', 18),
  ('brex', 'Brex', 'https://www.brex.com', 'https://www.brex.com/careers', 19),
  ('airtable', 'Airtable', 'https://www.airtable.com', 'https://www.airtable.com/careers', 20),
  ('deepgram', 'Deepgram', 'https://deepgram.com', 'https://deepgram.com/careers', 21),
  ('hackerone', 'HackerOne', 'https://www.hackerone.com', 'https://www.hackerone.com/careers', 22),
  ('zip', 'Zip', 'https://ziphq.com', 'https://ziphq.com/careers', 23),
  ('clay', 'Clay', 'https://www.clay.com', 'https://www.clay.com/careers', 24),
  ('phantom', 'Phantom', 'https://phantom.com', 'https://phantom.com/careers', 25),
  ('gusto', 'Gusto', 'https://gusto.com', 'https://gusto.com/about/careers', 26),
  ('ironclad', 'Ironclad', 'https://ironcladapp.com', 'https://ironcladapp.com/careers', 27),
  ('decagon', 'Decagon', 'https://www.decagon.ai', 'https://www.decagon.ai/careers', 28),
  ('databricks', 'Databricks', 'https://www.databricks.com', 'https://www.databricks.com/company/careers', 29),
  ('snowflake', 'Snowflake', 'https://www.snowflake.com', 'https://careers.snowflake.com', 30),
  ('optiver', 'Optiver', 'https://optiver.com', 'https://optiver.com/working-at-optiver/career-opportunities', 31),
  ('mongodb', 'MongoDB', 'https://www.mongodb.com', 'https://www.mongodb.com/careers', 32),
  ('cloudflare', 'Cloudflare', 'https://www.cloudflare.com', 'https://www.cloudflare.com/careers', 33),
  ('doordash', 'DoorDash', 'https://www.doordash.com', 'https://careers.doordash.com', 34),
  ('instacart', 'Instacart', 'https://www.instacart.com', 'https://instacart.careers', 35),
  ('shopify', 'Shopify', 'https://www.shopify.com', 'https://www.shopify.com/careers', 36),
  ('block', 'Block', 'https://block.xyz', 'https://block.xyz/careers', 37),
  ('hubspot', 'HubSpot', 'https://www.hubspot.com', 'https://www.hubspot.com/careers', 38),
  ('roblox', 'Roblox', 'https://www.roblox.com', 'https://careers.roblox.com', 39),
  ('rippling', 'Rippling', 'https://www.rippling.com', 'https://www.rippling.com/careers', 40),
  ('scale-ai', 'Scale AI', 'https://scale.com', 'https://scale.com/careers', 41),
  ('anduril', 'Anduril', 'https://www.anduril.com', 'https://www.anduril.com/careers', 42)
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
    (select id from public.companies where slug = 'reddit'),
    'greenhouse',
    'reddit-greenhouse',
    'https://boards.greenhouse.io/reddit',
    'reddit',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'asana'),
    'greenhouse',
    'asana-greenhouse',
    'https://boards.greenhouse.io/asana',
    'asana',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'brex'),
    'greenhouse',
    'brex-greenhouse',
    'https://boards.greenhouse.io/brex',
    'brex',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'gusto'),
    'greenhouse',
    'gusto-greenhouse',
    'https://boards.greenhouse.io/gusto',
    'gusto',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'mongodb'),
    'greenhouse',
    'mongodb-greenhouse',
    'https://boards.greenhouse.io/mongodb',
    'mongodb',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'cloudflare'),
    'greenhouse',
    'cloudflare-greenhouse',
    'https://boards.greenhouse.io/cloudflare',
    'cloudflare',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'doordash'),
    'greenhouse',
    'doordash-greenhouse',
    'https://boards.greenhouse.io/doordash',
    'doordash',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'instacart'),
    'greenhouse',
    'instacart-greenhouse',
    'https://boards.greenhouse.io/instacart',
    'instacart',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'shopify'),
    'greenhouse',
    'shopify-greenhouse',
    'https://boards.greenhouse.io/shopify',
    'shopify',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'block'),
    'greenhouse',
    'block-greenhouse',
    'https://boards.greenhouse.io/block',
    'block',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'hubspot'),
    'greenhouse',
    'hubspot-greenhouse',
    'https://boards.greenhouse.io/hubspot',
    'hubspot',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'roblox'),
    'greenhouse',
    'roblox-greenhouse',
    'https://boards.greenhouse.io/roblox',
    'roblox',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'anduril'),
    'greenhouse',
    'anduril-greenhouse',
    'https://boards.greenhouse.io/anduril',
    'anduril',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'optiver'),
    'greenhouse',
    'optiver-greenhouse',
    'https://job-boards.greenhouse.io/optiverus',
    'optiverus',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'databricks'),
    'greenhouse',
    'databricks-greenhouse',
    'https://boards.greenhouse.io/databricks',
    'databricks',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'airtable'),
    'ashby',
    'airtable-ashby',
    'https://jobs.ashbyhq.com/airtable',
    'airtable',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'deepgram'),
    'ashby',
    'deepgram-ashby',
    'https://jobs.ashbyhq.com/deepgram',
    'deepgram',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'hackerone'),
    'ashby',
    'hackerone-ashby',
    'https://jobs.ashbyhq.com/hackerone',
    'hackerone',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'zip'),
    'ashby',
    'zip-ashby',
    'https://jobs.ashbyhq.com/zip',
    'zip',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'clay'),
    'ashby',
    'clay-ashby',
    'https://jobs.ashbyhq.com/claylabs',
    'claylabs',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'phantom'),
    'ashby',
    'phantom-ashby',
    'https://jobs.ashbyhq.com/phantom',
    'phantom',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'ironclad'),
    'ashby',
    'ironclad-ashby',
    'https://jobs.ashbyhq.com/ironcladhq',
    'ironcladhq',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'decagon'),
    'ashby',
    'decagon-ashby',
    'https://jobs.ashbyhq.com/decagon',
    'decagon',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'snowflake'),
    'ashby',
    'snowflake-ashby',
    'https://jobs.ashbyhq.com/snowflake',
    'snowflake',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'rippling'),
    'ashby',
    'rippling-ashby',
    'https://jobs.ashbyhq.com/rippling',
    'rippling',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'scale-ai'),
    'ashby',
    'scale-ai-ashby',
    'https://jobs.ashbyhq.com/scaleai',
    'scaleai',
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
