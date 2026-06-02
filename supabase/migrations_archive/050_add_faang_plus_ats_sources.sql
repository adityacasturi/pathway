-- Migration 050: Add FAANG+ ATS sources (Greenhouse, Lever, Ashby)
-- Note: This migration intentionally avoids any tier metadata flags.

-- 1) Ensure target companies exist and are active.
insert into public.companies (slug, name, website_url, careers_url, is_active)
values
  ('airbnb', 'Airbnb', 'https://www.airbnb.com', 'https://careers.airbnb.com', true),
  ('anthropic', 'Anthropic', 'https://www.anthropic.com', 'https://www.anthropic.com/jobs', true),
  ('asana', 'Asana', 'https://asana.com', 'https://asana.com/jobs', true),
  ('airtable', 'Airtable', 'https://www.airtable.com', 'https://www.airtable.com/careers', true),
  ('brex', 'Brex', 'https://www.brex.com', 'https://www.brex.com/careers', true),
  ('clay', 'Clay', 'https://www.clay.com', 'https://www.clay.com/careers', true),
  ('coinbase', 'Coinbase', 'https://www.coinbase.com', 'https://www.coinbase.com/careers', true),
  ('datadog', 'Datadog', 'https://www.datadoghq.com', 'https://careers.datadoghq.com', true),
  ('decagon', 'Decagon', 'https://www.decagon.ai', 'https://www.decagon.ai/careers', true),
  ('deepgram', 'Deepgram', 'https://deepgram.com', 'https://deepgram.com/careers', true),
  ('discord', 'Discord', 'https://discord.com', 'https://discord.com/careers', true),
  ('dropbox', 'Dropbox', 'https://www.dropbox.com', 'https://www.dropbox.com/jobs', true),
  ('figma', 'Figma', 'https://www.figma.com', 'https://www.figma.com/careers', true),
  ('gusto', 'Gusto', 'https://gusto.com', 'https://gusto.com/about/careers', true),
  ('hackerone', 'HackerOne', 'https://www.hackerone.com', 'https://www.hackerone.com/careers', true),
  ('ironclad', 'Ironclad', 'https://ironcladapp.com', 'https://ironcladapp.com/careers', true),
  ('linear', 'Linear', 'https://linear.app', 'https://linear.app/careers', true),
  ('notion', 'Notion', 'https://www.notion.so', 'https://www.notion.so/careers', true),
  ('openai', 'OpenAI', 'https://openai.com', 'https://openai.com/careers', true),
  ('palantir', 'Palantir', 'https://www.palantir.com', 'https://www.palantir.com/careers', true),
  ('perplexity', 'Perplexity', 'https://www.perplexity.ai', 'https://www.perplexity.ai/hub/careers', true),
  ('phantom', 'Phantom', 'https://phantom.com', 'https://phantom.com/careers', true),
  ('plaid', 'Plaid', 'https://plaid.com', 'https://plaid.com/careers', true),
  ('ramp', 'Ramp', 'https://ramp.com', 'https://ramp.com/careers', true),
  ('reddit', 'Reddit', 'https://www.redditinc.com', 'https://www.redditinc.com/careers', true),
  ('robinhood', 'Robinhood', 'https://robinhood.com', 'https://careers.robinhood.com', true),
  ('spotify', 'Spotify', 'https://www.spotify.com', 'https://www.lifeatspotify.com/jobs', true),
  ('stripe', 'Stripe', 'https://stripe.com', 'https://stripe.com/jobs', true),
  ('vercel', 'Vercel', 'https://vercel.com', 'https://vercel.com/careers', true),
  ('zip', 'Zip', 'https://ziphq.com', 'https://ziphq.com/careers', true)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  is_active = true,
  updated_at = now();

-- 2) Upsert ATS company sources for the selected FAANG+ companies.
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
  ((select id from public.companies where slug = 'stripe'), 'greenhouse', 'stripe-greenhouse', 'https://boards.greenhouse.io/stripe', 'stripe', true, 180),
  ((select id from public.companies where slug = 'figma'), 'greenhouse', 'figma-greenhouse', 'https://boards.greenhouse.io/figma', 'figma', true, 180),
  ((select id from public.companies where slug = 'airbnb'), 'greenhouse', 'airbnb-greenhouse', 'https://boards.greenhouse.io/airbnb', 'airbnb', true, 180),
  ((select id from public.companies where slug = 'coinbase'), 'greenhouse', 'coinbase-greenhouse', 'https://boards.greenhouse.io/coinbase', 'coinbase', true, 180),
  ((select id from public.companies where slug = 'robinhood'), 'greenhouse', 'robinhood-greenhouse', 'https://boards.greenhouse.io/robinhood', 'robinhood', true, 180),
  ((select id from public.companies where slug = 'reddit'), 'greenhouse', 'reddit-greenhouse', 'https://boards.greenhouse.io/reddit', 'reddit', true, 180),
  ((select id from public.companies where slug = 'discord'), 'greenhouse', 'discord-greenhouse', 'https://boards.greenhouse.io/discord', 'discord', true, 180),
  ((select id from public.companies where slug = 'dropbox'), 'greenhouse', 'dropbox-greenhouse', 'https://boards.greenhouse.io/dropbox', 'dropbox', true, 180),
  ((select id from public.companies where slug = 'plaid'), 'greenhouse', 'plaid-greenhouse', 'https://boards.greenhouse.io/plaid', 'plaid', true, 180),
  ((select id from public.companies where slug = 'brex'), 'greenhouse', 'brex-greenhouse', 'https://boards.greenhouse.io/brex', 'brex', true, 180),
  ((select id from public.companies where slug = 'asana'), 'greenhouse', 'asana-greenhouse', 'https://boards.greenhouse.io/asana', 'asana', true, 180),
  ((select id from public.companies where slug = 'datadog'), 'greenhouse', 'datadog-greenhouse', 'https://boards.greenhouse.io/datadog', 'datadog', true, 180),
  ((select id from public.companies where slug = 'gusto'), 'greenhouse', 'gusto-greenhouse', 'https://boards.greenhouse.io/gusto', 'gusto', true, 180),
  ((select id from public.companies where slug = 'anthropic'), 'greenhouse', 'anthropic-greenhouse', 'https://boards.greenhouse.io/anthropic', 'anthropic', true, 180),
  ((select id from public.companies where slug = 'palantir'), 'lever', 'palantir-lever', 'https://jobs.lever.co/palantir', 'palantir', true, 180),
  ((select id from public.companies where slug = 'spotify'), 'lever', 'spotify-lever', 'https://jobs.lever.co/spotify', 'spotify', true, 180),
  ((select id from public.companies where slug = 'notion'), 'ashby', 'notion-ashby', 'https://jobs.ashbyhq.com/notion', 'notion', true, 180),
  ((select id from public.companies where slug = 'ramp'), 'ashby', 'ramp-ashby', 'https://jobs.ashbyhq.com/ramp', 'ramp', true, 180),
  ((select id from public.companies where slug = 'vercel'), 'ashby', 'vercel-ashby', 'https://jobs.ashbyhq.com/vercel', 'vercel', true, 180),
  ((select id from public.companies where slug = 'linear'), 'ashby', 'linear-ashby', 'https://jobs.ashbyhq.com/linear', 'linear', true, 180),
  ((select id from public.companies where slug = 'openai'), 'ashby', 'openai-ashby', 'https://jobs.ashbyhq.com/openai', 'openai', true, 180),
  ((select id from public.companies where slug = 'perplexity'), 'ashby', 'perplexity-ashby', 'https://jobs.ashbyhq.com/perplexity', 'perplexity', true, 180),
  ((select id from public.companies where slug = 'airtable'), 'ashby', 'airtable-ashby', 'https://jobs.ashbyhq.com/airtable', 'airtable', true, 180),
  ((select id from public.companies where slug = 'decagon'), 'ashby', 'decagon-ashby', 'https://jobs.ashbyhq.com/decagon', 'decagon', true, 180),
  ((select id from public.companies where slug = 'deepgram'), 'ashby', 'deepgram-ashby', 'https://jobs.ashbyhq.com/deepgram', 'deepgram', true, 180),
  ((select id from public.companies where slug = 'hackerone'), 'ashby', 'hackerone-ashby', 'https://jobs.ashbyhq.com/hackerone', 'hackerone', true, 180),
  ((select id from public.companies where slug = 'zip'), 'ashby', 'zip-ashby', 'https://jobs.ashbyhq.com/zip', 'zip', true, 180),
  ((select id from public.companies where slug = 'ironclad'), 'ashby', 'ironclad-ashby', 'https://jobs.ashbyhq.com/ironcladhq', 'ironcladhq', true, 180),
  ((select id from public.companies where slug = 'clay'), 'ashby', 'clay-ashby', 'https://jobs.ashbyhq.com/claylabs', 'claylabs', true, 180),
  ((select id from public.companies where slug = 'phantom'), 'ashby', 'phantom-ashby', 'https://jobs.ashbyhq.com/phantom', 'phantom', true, 180)
on conflict (company_id, source_type, adapter_key, coalesce(board_token, ''), coalesce(source_url, '')) do update set
  source_url = excluded.source_url,
  board_token = excluded.board_token,
  enabled = true,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();
