-- Remove Jane Street from Discover and classify companies by industry.

alter table public.companies
  add column if not exists industry text;

-- Remove Jane Street from active Discover scrape targets.
delete from public.scraped_postings
where company_id = (select id from public.companies where slug = 'jane-street');

delete from public.company_sources
where company_id = (select id from public.companies where slug = 'jane-street');

update public.companies
set is_active = false, updated_at = now()
where slug = 'jane-street';

-- AI & ML
update public.companies set industry = 'ai', updated_at = now()
where slug in (
  'anthropic', 'openai', 'scale-ai', 'cohere', 'perplexity', 'harvey', 'langchain',
  'character-ai', 'elevenlabs', 'decagon', 'deepgram', 'cursor', 'sierra', 'anyscale', 'modal'
);

-- Fintech & crypto
update public.companies set industry = 'fintech', updated_at = now()
where slug in (
  'stripe', 'ramp', 'robinhood', 'brex', 'plaid', 'coinbase', 'affirm', 'chime', 'block',
  'mercury', 'column', 'marqeta', 'gemini', 'binance', 'sofi', 'phantom', 'carta'
);

-- Developer tools & infra
update public.companies set industry = 'devtools', updated_at = now()
where slug in (
  'vercel', 'supabase', 'datadog', 'cloudflare', 'mongodb', 'databricks', 'snowflake', 'gitlab',
  'elastic', 'cockroachlabs', 'planetscale', 'render', 'tailscale', 'posthog', 'replit', 'neon',
  'resend', 'merge', 'fastly', 'okta', 'zscaler', 'twilio', 'pagerduty', 'new-relic', 'box',
  'pure-storage', 'launchdarkly', 'amplitude', 'mixpanel', '1password', 'deel', 'watershed'
);

-- Consumer & media
update public.companies set industry = 'consumer', updated_at = now()
where slug in (
  'airbnb', 'doordash', 'instacart', 'spotify', 'reddit', 'discord', 'roblox', 'riot-games',
  'pinterest', 'netflix', 'duolingo', 'nextdoor', 'tripadvisor', 'coursera', 'carvana',
  'squarespace', 'toast', 'lyft', 'dropbox'
);

-- Enterprise & B2B
update public.companies set industry = 'enterprise', updated_at = now()
where slug in (
  'notion', 'figma', 'linear', 'asana', 'airtable', 'hubspot', 'gusto', 'ironclad', 'zip',
  'clay', 'rippling', 'loom', 'calendly', 'bill-com', 'yext', 'flexport', 'shopify', 'oscar'
);

-- Mobility & autonomy
update public.companies set industry = 'mobility', updated_at = now()
where slug in (
  'waymo', 'nuro', 'aurora', 'lucid-motors', 'applied-intuition', 'uber-freight', 'samsara'
);

-- Security & defense
update public.companies set industry = 'security', updated_at = now()
where slug in ('anduril', 'palantir', 'hackerone');

-- Quant & trading
update public.companies set industry = 'quant', updated_at = now()
where slug in ('optiver');

update public.companies
set industry = 'enterprise', updated_at = now()
where industry is null;

alter table public.companies
  alter column industry set default 'enterprise',
  alter column industry set not null;

alter table public.companies
  drop constraint if exists companies_industry_check;

alter table public.companies
  add constraint companies_industry_check
  check (
    industry in (
      'ai',
      'fintech',
      'devtools',
      'consumer',
      'enterprise',
      'mobility',
      'security',
      'quant'
    )
  );

create index if not exists companies_industry_priority_idx
  on public.companies (industry, priority)
  where is_active = true;
