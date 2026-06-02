-- Split broad Discover industries into finer-grained categories.

alter table public.companies
  drop constraint if exists companies_industry_check;

alter table public.companies
  alter column industry set default 'b2b';

-- Big tech
update public.companies set industry = 'big-tech', updated_at = now()
where slug in (
  'google', 'microsoft', 'meta', 'amazon', 'apple', 'nvidia', 'intel'
);

-- AI (unchanged cohort)
update public.companies set industry = 'ai', updated_at = now()
where slug in (
  'anthropic', 'openai', 'scale-ai', 'cohere', 'perplexity', 'harvey', 'langchain',
  'character-ai', 'elevenlabs', 'decagon', 'deepgram', 'cursor', 'sierra', 'anyscale',
  'modal', 'xai', 'fal', 'runpod', 'benchling', '10x-genomics', 'baseten', 'dust',
  'lovable', 'together-ai', 'writer', 'mistral'
);

-- Cloud & infra (from devtools / ai infra)
update public.companies set industry = 'cloud', updated_at = now()
where slug in (
  'cloudflare', 'fastly', 'render', 'railway', 'tailscale', 'box', 'pure-storage',
  'twilio', 'pagerduty', 'deel', 'coreweave', 'lambda', 'nebius', 'cisco', 'micron'
);

-- Data platforms (from devtools)
update public.companies set industry = 'data', updated_at = now()
where slug in (
  'datadog', 'mongodb', 'databricks', 'snowflake', 'elastic', 'cockroachlabs',
  'planetscale', 'amplitude', 'mixpanel', 'clickhouse', 'fivetran', 'confluent',
  'airbyte', 'materialize', 'motherduck', 'hex-technologies', 'lightdash', 'omni',
  'statsig', 'braze', 'fullstory', 'new-relic'
);

-- Dev tools (narrower)
update public.companies set industry = 'devtools', updated_at = now()
where slug in (
  'vercel', 'supabase', 'gitlab', 'posthog', 'replit', 'neon', 'resend', 'merge',
  'launchdarkly', 'sentry', 'buildkite', 'circleci', 'coder', 'prefect', 'sanity',
  'canonical', 'watershed', 'redis', 'jetbrains'
);

-- Security (from devtools / security)
update public.companies set industry = 'security', updated_at = now()
where slug in (
  'okta', 'zscaler', '1password', 'palo-alto-networks', 'anduril', 'tanium',
  'palantir', 'hackerone', 'drata', 'vanta', 'rubrik'
);

-- Gaming (from consumer)
update public.companies set industry = 'gaming', updated_at = now()
where slug in (
  'roblox', 'riot-games', 'epic-games', 'unity', 'scopely', 'take-two', 'twitch'
);

-- Productivity (from enterprise)
update public.companies set industry = 'productivity', updated_at = now()
where slug in (
  'notion', 'figma', 'linear', 'asana', 'airtable', 'loom', 'calendly', 'clay',
  'zip', 'ironclad', 'adobe', 'autodesk'
);

-- B2B software (from enterprise / mobility ops)
update public.companies set industry = 'b2b', updated_at = now()
where slug in (
  'hubspot', 'gusto', 'rippling', 'bill-com', 'yext', 'flexport', 'shopify', 'oscar',
  'intercom', 'clover-health', 'faire', 'thumbtack', 'workday', 'attentive', 'klaviyo',
  'workato', 'samsara', 'uber-freight'
);

-- Autonomy (from mobility)
update public.companies set industry = 'autonomy', updated_at = now()
where slug in (
  'waymo', 'nuro', 'aurora', 'lucid-motors', 'applied-intuition', 'zoox', 'wayve',
  'bird', 'chargepoint'
);

-- Aerospace (from mobility)
update public.companies set industry = 'aerospace', updated_at = now()
where slug in (
  'boeing', 'spacex', 'astranis', 'relativity', 'rocket-lab', 'skydio'
);

-- Quant (add HRT / Two Sigma / Citadel when present)
update public.companies set industry = 'quant', updated_at = now()
where slug in (
  'optiver', 'aquatic-capital', 'jump-trading', 'drw', 'imc', 'akuna-capital', 'aqr',
  'worldquant', 'point72', 'virtu', 'flow-traders', 'schonfeld', 'jane-street',
  'hudson-river-trading', 'two-sigma', 'citadel'
);

-- Remap legacy bucket values for rows not listed above.
update public.companies set industry = 'b2b', updated_at = now()
where industry = 'enterprise';

update public.companies set industry = 'autonomy', updated_at = now()
where industry = 'mobility';

-- Any company still on a removed industry label falls back to B2B.
update public.companies set industry = 'b2b', updated_at = now()
where industry not in (
  'big-tech', 'ai', 'fintech', 'crypto', 'cloud', 'data', 'devtools', 'security',
  'gaming', 'consumer', 'productivity', 'b2b', 'autonomy', 'aerospace', 'quant'
);

alter table public.companies
  add constraint companies_industry_check
  check (
    industry in (
      'big-tech',
      'ai',
      'fintech',
      'crypto',
      'cloud',
      'data',
      'devtools',
      'security',
      'gaming',
      'consumer',
      'productivity',
      'b2b',
      'autonomy',
      'aerospace',
      'quant'
    )
  );
