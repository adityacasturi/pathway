-- Expand alert bundles beyond broad industries and add sidebar grouping metadata.

alter table public.alert_curated_sectors
  add column if not exists group_label text not null default 'Industry bundles',
  add column if not exists group_sort_order integer not null default 10;

with bundle_rows(slug, label, description, sort_order, group_label, group_sort_order) as (
  values
    -- Industry bundles
    ('faang', 'FAANG+', 'Meta, Apple, Amazon, Netflix, Google, Microsoft, and NVIDIA.', 10, 'Industry bundles', 10),
    ('ai-stack', 'AI labs', 'Frontier labs, AI products, and applied AI companies.', 20, 'Industry bundles', 10),
    ('ai-infra', 'AI infrastructure', 'Model infra, inference, data labeling, GPUs, and AI developer platforms.', 30, 'Industry bundles', 10),
    ('devtools', 'Developer tools', 'Code, CI, database, observability, deployment, and internal tooling companies.', 40, 'Industry bundles', 10),
    ('data-platforms', 'Data platforms', 'Warehouse, analytics, streaming, observability, and product data companies.', 50, 'Industry bundles', 10),
    ('cloud-infra', 'Cloud infrastructure', 'Cloud, edge, storage, networking, and hosting platforms.', 60, 'Industry bundles', 10),
    ('cybersecurity', 'Cybersecurity', 'Security leaders across endpoint, cloud, identity, compliance, and app security.', 70, 'Industry bundles', 10),
    ('fintech', 'Fintech', 'Consumer finance, banking infra, credit, identity, and modern finance platforms.', 80, 'Industry bundles', 10),
    ('payments', 'Payments', 'Payments networks, processors, card issuing, and payments infrastructure.', 90, 'Industry bundles', 10),
    ('quant', 'Quant', 'Quant trading, hedge funds, market makers, and systematic investment firms.', 100, 'Industry bundles', 10),
    ('semis', 'Semiconductors', 'Chip leaders, EDA, storage, and semiconductor hardware companies.', 110, 'Industry bundles', 10),
    ('autonomous', 'Autonomous & robotics', 'Self-driving, robotics, autonomy platforms, and embodied AI.', 120, 'Industry bundles', 10),
    ('defense', 'Defense & space', 'Defense tech, aerospace primes, space companies, and national security software.', 130, 'Industry bundles', 10),
    ('gaming', 'Gaming', 'Game studios, engines, platforms, and interactive entertainment companies.', 140, 'Industry bundles', 10),
    ('marketplaces', 'Marketplaces', 'Travel, local, e-commerce, creator, and transaction-heavy consumer marketplaces.', 150, 'Industry bundles', 10),

    -- Tech archetypes
    ('b2b-saas', 'B2B SaaS', 'Rippling-style SaaS for company workflows, finance, HR, legal, sales, and operations.', 10, 'Tech archetypes', 20),
    ('infra-devtools', 'Infra & devtools', 'Engineering-heavy infrastructure, developer platforms, databases, and deployment tools.', 20, 'Tech archetypes', 20),
    ('product-led-tools', 'Product-led tools', 'Polished productivity, collaboration, design, and workflow products.', 30, 'Tech archetypes', 20),
    ('data-observability', 'Data & observability', 'Data platforms, monitoring, analytics, experimentation, and product intelligence.', 40, 'Tech archetypes', 20),
    ('ml-platforms', 'ML platforms', 'ML tooling, model serving, AI infrastructure, and applied model platforms.', 50, 'Tech archetypes', 20),
    ('trust-compliance', 'Trust & compliance', 'Security, compliance, fraud, identity, and risk platforms.', 60, 'Tech archetypes', 20),
    ('internal-tools', 'Internal tools', 'Low-code, automation, workflow, and ops platforms for business users.', 70, 'Tech archetypes', 20),
    ('consumer-platforms', 'Consumer platforms', 'Consumer internet, marketplaces, media, social, and creator platforms with strong SWE teams.', 80, 'Tech archetypes', 20),

    -- Startup archetypes
    ('unicorns', 'Top unicorns', 'Highly recognized private tech companies with strong internship signal.', 10, 'Startup archetypes', 30),
    ('hot-ai-startups', 'Hot AI startups', 'Fast-growing model, AI product, AI infra, and agent companies.', 20, 'Startup archetypes', 30),
    ('rippling-style', 'Rippling-style operators', 'Business OS, HR, finance, procurement, compliance, and operational workflow startups.', 30, 'Startup archetypes', 30),
    ('design-productivity-startups', 'Design & productivity startups', 'Modern tools for design, docs, planning, collaboration, and creative work.', 40, 'Startup archetypes', 30),
    ('fintech-startups', 'Fintech startups', 'High-growth fintech, banking, credit, spend, crypto, and financial infrastructure companies.', 50, 'Startup archetypes', 30),
    ('deep-tech-startups', 'Deep tech startups', 'Space, robotics, autonomy, AI hardware, and advanced systems startups.', 60, 'Startup archetypes', 30),
    ('remote-startups', 'Remote-friendly startups', 'Distributed and remote-friendly engineering cultures.', 70, 'Startup archetypes', 30),

    -- Prestige
    ('prestige-big-tech', 'Prestige: big tech', 'Large, selective software employers with strong resume signal.', 10, 'Prestige', 40),
    ('prestige-startups', 'Prestige: startups', 'Selective private companies and high-signal startup brands.', 20, 'Prestige', 40),
    ('prestige-infra', 'Prestige: infra', 'Deep technical infra, systems, cloud, data, and developer platform companies.', 30, 'Prestige', 40),
    ('prestige-ai', 'Prestige: AI', 'Frontier labs, model companies, and AI infrastructure leaders.', 40, 'Prestige', 40),
    ('quant-tier-1', 'Quant tier 1', 'Most selective quant and trading firms for SWE, quant dev, and research internships.', 50, 'Prestige', 40),
    ('quant-tier-2', 'Quant tier 2', 'Highly competitive quant and trading firms beyond the top tier.', 60, 'Prestige', 40),
    ('freshman-friendly', 'Freshman-friendly', 'Large programs and accessible pipelines that are reasonable targets for earlier students.', 70, 'Prestige', 40),
    ('new-grad-friendly', 'New grad-friendly', 'Companies with recurring early-career engineering pipelines.', 80, 'Prestige', 40)
)
insert into public.alert_curated_sectors (
  slug,
  label,
  description,
  sort_order,
  group_label,
  group_sort_order
)
select slug, label, description, sort_order, group_label, group_sort_order
from bundle_rows
on conflict (slug) do update
set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  group_label = excluded.group_label,
  group_sort_order = excluded.group_sort_order;

with managed_bundles(slug) as (
  values
    ('faang'), ('ai-stack'), ('ai-infra'), ('devtools'), ('data-platforms'),
    ('cloud-infra'), ('cybersecurity'), ('fintech'), ('payments'), ('quant'),
    ('semis'), ('autonomous'), ('defense'), ('gaming'), ('marketplaces'),
    ('b2b-saas'), ('infra-devtools'), ('product-led-tools'), ('data-observability'),
    ('ml-platforms'), ('trust-compliance'), ('internal-tools'), ('consumer-platforms'),
    ('unicorns'), ('hot-ai-startups'), ('rippling-style'), ('design-productivity-startups'),
    ('fintech-startups'), ('deep-tech-startups'), ('remote-startups'),
    ('prestige-big-tech'), ('prestige-startups'), ('prestige-infra'), ('prestige-ai'),
    ('quant-tier-1'), ('quant-tier-2'), ('freshman-friendly'), ('new-grad-friendly')
)
delete from public.alert_curated_sector_companies m
using managed_bundles b
where m.sector_slug = b.slug;

with bundle_members(sector_slug, company_slug) as (
  values
    ('faang', 'meta'), ('faang', 'apple'), ('faang', 'amazon'), ('faang', 'netflix'),
    ('faang', 'google'), ('faang', 'microsoft'), ('faang', 'nvidia'),

    ('ai-stack', 'openai'), ('ai-stack', 'anthropic'), ('ai-stack', 'xai'),
    ('ai-stack', 'deepmind'), ('ai-stack', 'mistral'), ('ai-stack', 'cohere'),
    ('ai-stack', 'perplexity'), ('ai-stack', 'cursor'), ('ai-stack', 'cognition'),
    ('ai-stack', 'safe-superintelligence'), ('ai-stack', 'thinking-machines'),
    ('ai-stack', 'world-labs'), ('ai-stack', 'character-ai'), ('ai-stack', 'glean'),
    ('ai-stack', 'harvey'), ('ai-stack', 'decagon'), ('ai-stack', 'sierra'),
    ('ai-stack', 'elevenlabs'), ('ai-stack', 'runway'), ('ai-stack', 'midjourney'),

    ('ai-infra', 'nvidia'), ('ai-infra', 'coreweave'), ('ai-infra', 'databricks'),
    ('ai-infra', 'hugging-face'), ('ai-infra', 'scale-ai'), ('ai-infra', 'weights-biases'),
    ('ai-infra', 'modal'), ('ai-infra', 'replicate'), ('ai-infra', 'together-ai'),
    ('ai-infra', 'fireworks-ai'), ('ai-infra', 'groq'), ('ai-infra', 'cerebras'),
    ('ai-infra', 'sambanova'), ('ai-infra', 'tenstorrent'), ('ai-infra', 'lambda'),
    ('ai-infra', 'runpod'), ('ai-infra', 'baseten'), ('ai-infra', 'anyscale'),
    ('ai-infra', 'snorkel-ai'), ('ai-infra', 'surge-ai'),

    ('devtools', 'github'), ('devtools', 'gitlab'), ('devtools', 'docker'),
    ('devtools', 'hashicorp'), ('devtools', 'jetbrains'), ('devtools', 'circleci'),
    ('devtools', 'buildkite'), ('devtools', 'vercel'), ('devtools', 'supabase'),
    ('devtools', 'replit'), ('devtools', 'postman'),
    ('devtools', 'sentry'), ('devtools', 'sourcegraph'), ('devtools', 'launchdarkly'),
    ('devtools', 'redis'), ('devtools', 'neon'), ('devtools', 'planetscale'),
    ('devtools', 'railway'), ('devtools', 'render'), ('devtools', 'canonical'),

    ('data-platforms', 'databricks'), ('data-platforms', 'snowflake'),
    ('data-platforms', 'mongodb'), ('data-platforms', 'confluent'),
    ('data-platforms', 'datadog'), ('data-platforms', 'elastic'),
    ('data-platforms', 'fivetran'), ('data-platforms', 'dbt-labs'),
    ('data-platforms', 'clickhouse'), ('data-platforms', 'cockroachlabs'),
    ('data-platforms', 'airbyte'), ('data-platforms', 'amplitude'),
    ('data-platforms', 'mixpanel'), ('data-platforms', 'statsig'),
    ('data-platforms', 'braze'), ('data-platforms', 'new-relic'),

    ('cloud-infra', 'cloudflare'), ('cloud-infra', 'coreweave'), ('cloud-infra', 'digitalocean'),
    ('cloud-infra', 'fastly'), ('cloud-infra', 'akamai'), ('cloud-infra', 'twilio'),
    ('cloud-infra', 'pagerduty'), ('cloud-infra', 'tailscale'), ('cloud-infra', 'vmware'),
    ('cloud-infra', 'pure-storage'), ('cloud-infra', 'cohesity'), ('cloud-infra', 'nutanix'),

    ('cybersecurity', 'crowdstrike'), ('cybersecurity', 'palo-alto-networks'),
    ('cybersecurity', 'okta'), ('cybersecurity', 'wiz'), ('cybersecurity', 'sentinelone'),
    ('cybersecurity', 'zscaler'), ('cybersecurity', 'snyk'), ('cybersecurity', 'rubrik'),
    ('cybersecurity', 'splunk'), ('cybersecurity', 'vanta'), ('cybersecurity', 'drata'),
    ('cybersecurity', '1password'), ('cybersecurity', 'hackerone'), ('cybersecurity', 'verkada'),

    ('fintech', 'stripe'), ('fintech', 'ramp'), ('fintech', 'brex'), ('fintech', 'plaid'),
    ('fintech', 'coinbase'), ('fintech', 'robinhood'), ('fintech', 'affirm'),
    ('fintech', 'block'), ('fintech', 'chime'), ('fintech', 'mercury'), ('fintech', 'revolut'),
    ('fintech', 'monzo'), ('fintech', 'wise'), ('fintech', 'persona'), ('fintech', 'middesk'),
    ('fintech', 'carta'), ('fintech', 'sofi'),

    ('payments', 'stripe'), ('payments', 'adyen'), ('payments', 'visa'), ('payments', 'mastercard'),
    ('payments', 'paypal'), ('payments', 'block'), ('payments', 'marqeta'), ('payments', 'lithic'),
    ('payments', 'column'), ('payments', 'highnote'),

    ('quant', 'jane-street'), ('quant', 'citadel'), ('quant', 'citadel-securities'),
    ('quant', 'hudson-river-trading'), ('quant', 'two-sigma'), ('quant', 'de-shaw'),
    ('quant', 'optiver'), ('quant', 'sig'), ('quant', 'five-rings'), ('quant', 'jump-trading'),
    ('quant', 'imc'), ('quant', 'drw'), ('quant', 'tower-research'), ('quant', 'millennium'),
    ('quant', 'point72'), ('quant', 'balyasny'), ('quant', 'akuna-capital'),
    ('quant', 'old-mission'), ('quant', 'virtu'), ('quant', 'xtx-markets'),

    ('semis', 'nvidia'), ('semis', 'amd'), ('semis', 'intel'), ('semis', 'qualcomm'),
    ('semis', 'broadcom'), ('semis', 'micron'), ('semis', 'arm'), ('semis', 'marvell'),
    ('semis', 'cadence'), ('semis', 'synopsys'), ('semis', 'texas-instruments'),
    ('semis', 'analog-devices'), ('semis', 'samsung'), ('semis', 'western-digital'),

    ('autonomous', 'waymo'), ('autonomous', 'zoox'), ('autonomous', 'nuro'),
    ('autonomous', 'aurora'), ('autonomous', 'applied-intuition'), ('autonomous', 'waabi'),
    ('autonomous', 'wayve'), ('autonomous', 'tesla'), ('autonomous', 'figure-ai'),
    ('autonomous', 'skild-ai'), ('autonomous', '1x-technologies'), ('autonomous', 'neuralink'),

    ('defense', 'anduril'), ('defense', 'palantir'), ('defense', 'lockheed-martin'),
    ('defense', 'northrop-grumman'), ('defense', 'rtx'), ('defense', 'boeing'),
    ('defense', 'general-dynamics'), ('defense', 'l3harris'), ('defense', 'bae-systems'),
    ('defense', 'leidos'), ('defense', 'shield-ai'), ('defense', 'spacex'),
    ('defense', 'blue-origin'), ('defense', 'rocket-lab'), ('defense', 'sierra-space'),

    ('gaming', 'roblox'), ('gaming', 'riot-games'), ('gaming', 'epic-games'),
    ('gaming', 'electronic-arts'), ('gaming', 'unity'), ('gaming', 'twitch'),
    ('gaming', 'valve'), ('gaming', 'sony'), ('gaming', 'take-two'),

    ('marketplaces', 'airbnb'), ('marketplaces', 'doordash'), ('marketplaces', 'uber'),
    ('marketplaces', 'instacart'), ('marketplaces', 'etsy'), ('marketplaces', 'zillow'),
    ('marketplaces', 'wayfair'), ('marketplaces', 'faire'), ('marketplaces', 'thumbtack'),
    ('marketplaces', 'expedia'),

    ('b2b-saas', 'rippling'), ('b2b-saas', 'deel'), ('b2b-saas', 'gusto'),
    ('b2b-saas', 'workday'), ('b2b-saas', 'servicenow'), ('b2b-saas', 'salesforce'),
    ('b2b-saas', 'hubspot'), ('b2b-saas', 'klaviyo'), ('b2b-saas', 'intercom'),
    ('b2b-saas', 'attentive'), ('b2b-saas', 'braze'), ('b2b-saas', 'workato'),
    ('b2b-saas', 'bill-com'), ('b2b-saas', 'zip'), ('b2b-saas', 'ironclad'),
    ('b2b-saas', 'docusign'), ('b2b-saas', 'samsara'), ('b2b-saas', 'toast'),
    ('b2b-saas', 'zendesk'), ('b2b-saas', 'yext'),

    ('infra-devtools', 'github'), ('infra-devtools', 'gitlab'), ('infra-devtools', 'docker'),
    ('infra-devtools', 'hashicorp'), ('infra-devtools', 'cloudflare'), ('infra-devtools', 'datadog'),
    ('infra-devtools', 'vercel'), ('infra-devtools', 'supabase'), ('infra-devtools', 'sentry'),
    ('infra-devtools', 'sourcegraph'), ('infra-devtools', 'launchdarkly'), ('infra-devtools', 'redis'),
    ('infra-devtools', 'neon'), ('infra-devtools', 'planetscale'), ('infra-devtools', 'render'),
    ('infra-devtools', 'railway'), ('infra-devtools', 'tailscale'), ('infra-devtools', 'fastly'),

    ('product-led-tools', 'figma'), ('product-led-tools', 'notion'), ('product-led-tools', 'canva'),
    ('product-led-tools', 'linear'), ('product-led-tools', 'airtable'), ('product-led-tools', 'asana'),
    ('product-led-tools', 'atlassian'), ('product-led-tools', 'slack'), ('product-led-tools', 'loom'),
    ('product-led-tools', 'calendly'), ('product-led-tools', 'clay'), ('product-led-tools', 'adobe'),
    ('product-led-tools', 'autodesk'), ('product-led-tools', 'intuit'), ('product-led-tools', 'zip'),

    ('data-observability', 'datadog'), ('data-observability', 'snowflake'),
    ('data-observability', 'databricks'), ('data-observability', 'confluent'),
    ('data-observability', 'mongodb'), ('data-observability', 'elastic'),
    ('data-observability', 'amplitude'), ('data-observability', 'mixpanel'),
    ('data-observability', 'statsig'), ('data-observability', 'new-relic'),
    ('data-observability', 'fullstory'), ('data-observability', 'hex-technologies'),

    ('ml-platforms', 'hugging-face'), ('ml-platforms', 'weights-biases'), ('ml-platforms', 'modal'),
    ('ml-platforms', 'replicate'), ('ml-platforms', 'together-ai'), ('ml-platforms', 'fireworks-ai'),
    ('ml-platforms', 'baseten'), ('ml-platforms', 'anyscale'), ('ml-platforms', 'labelbox'),
    ('ml-platforms', 'scale-ai'), ('ml-platforms', 'snorkel-ai'), ('ml-platforms', 'surge-ai'),

    ('trust-compliance', 'vanta'), ('trust-compliance', 'drata'), ('trust-compliance', 'persona'),
    ('trust-compliance', 'middesk'), ('trust-compliance', 'sift'), ('trust-compliance', 'socure'),
    ('trust-compliance', 'sentilink'), ('trust-compliance', 'okta'), ('trust-compliance', '1password'),
    ('trust-compliance', 'hackerone'), ('trust-compliance', 'snyk'),

    ('internal-tools', 'retool'), ('internal-tools', 'workato'), ('internal-tools', 'airtable'),
    ('internal-tools', 'notion'), ('internal-tools', 'asana'), ('internal-tools', 'linear'),
    ('internal-tools', 'zapier'), ('internal-tools', 'merge'), ('internal-tools', 'prefect'),
    ('internal-tools', 'posthog'), ('internal-tools', 'launchdarkly'),

    ('consumer-platforms', 'airbnb'), ('consumer-platforms', 'doordash'), ('consumer-platforms', 'uber'),
    ('consumer-platforms', 'lyft'), ('consumer-platforms', 'instacart'), ('consumer-platforms', 'reddit'),
    ('consumer-platforms', 'discord'), ('consumer-platforms', 'pinterest'), ('consumer-platforms', 'snap'),
    ('consumer-platforms', 'spotify'), ('consumer-platforms', 'duolingo'), ('consumer-platforms', 'coursera'),
    ('consumer-platforms', 'expedia'), ('consumer-platforms', 'tripadvisor'),

    ('unicorns', 'stripe'), ('unicorns', 'databricks'), ('unicorns', 'figma'),
    ('unicorns', 'notion'), ('unicorns', 'canva'), ('unicorns', 'rippling'),
    ('unicorns', 'ramp'), ('unicorns', 'brex'), ('unicorns', 'mercury'),
    ('unicorns', 'deel'), ('unicorns', 'plaid'), ('unicorns', 'discord'),
    ('unicorns', 'scale-ai'), ('unicorns', 'coreweave'), ('unicorns', 'hugging-face'),
    ('unicorns', 'gusto'), ('unicorns', 'carta'), ('unicorns', 'retool'),

    ('hot-ai-startups', 'anthropic'), ('hot-ai-startups', 'openai'), ('hot-ai-startups', 'xai'),
    ('hot-ai-startups', 'cursor'), ('hot-ai-startups', 'perplexity'), ('hot-ai-startups', 'cognition'),
    ('hot-ai-startups', 'safe-superintelligence'), ('hot-ai-startups', 'thinking-machines'),
    ('hot-ai-startups', 'world-labs'), ('hot-ai-startups', 'mistral'), ('hot-ai-startups', 'elevenlabs'),
    ('hot-ai-startups', 'runway'), ('hot-ai-startups', 'suno'), ('hot-ai-startups', 'luma-ai'),
    ('hot-ai-startups', 'harvey'), ('hot-ai-startups', 'decagon'), ('hot-ai-startups', 'sierra'),
    ('hot-ai-startups', 'physical-intelligence'), ('hot-ai-startups', 'skild-ai'),

    ('rippling-style', 'rippling'), ('rippling-style', 'deel'), ('rippling-style', 'gusto'),
    ('rippling-style', 'workday'), ('rippling-style', 'bill-com'), ('rippling-style', 'zip'),
    ('rippling-style', 'ironclad'), ('rippling-style', 'docusign'), ('rippling-style', 'carta'),
    ('rippling-style', 'brex'), ('rippling-style', 'ramp'), ('rippling-style', 'mercury'),
    ('rippling-style', 'middesk'), ('rippling-style', 'persona'), ('rippling-style', 'vanta'),
    ('rippling-style', 'drata'), ('rippling-style', 'workato'), ('rippling-style', 'attentive'),

    ('design-productivity-startups', 'figma'), ('design-productivity-startups', 'notion'),
    ('design-productivity-startups', 'linear'), ('design-productivity-startups', 'airtable'),
    ('design-productivity-startups', 'canva'), ('design-productivity-startups', 'clay'),
    ('design-productivity-startups', 'loom'), ('design-productivity-startups', 'calendly'),
    ('design-productivity-startups', 'grammarly'), ('design-productivity-startups', 'runway'),
    ('design-productivity-startups', 'midjourney'), ('design-productivity-startups', 'ideogram'),

    ('fintech-startups', 'stripe'), ('fintech-startups', 'ramp'), ('fintech-startups', 'brex'),
    ('fintech-startups', 'mercury'), ('fintech-startups', 'plaid'), ('fintech-startups', 'robinhood'),
    ('fintech-startups', 'chime'), ('fintech-startups', 'affirm'), ('fintech-startups', 'revolut'),
    ('fintech-startups', 'monzo'), ('fintech-startups', 'wise'), ('fintech-startups', 'carta'),
    ('fintech-startups', 'persona'), ('fintech-startups', 'middesk'), ('fintech-startups', 'column'),
    ('fintech-startups', 'lithic'), ('fintech-startups', 'highnote'),

    ('deep-tech-startups', 'spacex'), ('deep-tech-startups', 'anduril'), ('deep-tech-startups', 'waymo'),
    ('deep-tech-startups', 'zoox'), ('deep-tech-startups', 'applied-intuition'), ('deep-tech-startups', 'figure-ai'),
    ('deep-tech-startups', 'skild-ai'), ('deep-tech-startups', '1x-technologies'), ('deep-tech-startups', 'neuralink'),
    ('deep-tech-startups', 'astranis'), ('deep-tech-startups', 'varda-space'), ('deep-tech-startups', 'relativity'),
    ('deep-tech-startups', 'rocket-lab'), ('deep-tech-startups', 'cerebras'), ('deep-tech-startups', 'groq'),
    ('deep-tech-startups', 'lightmatter'), ('deep-tech-startups', 'tenstorrent'),

    ('remote-startups', 'gitlab'), ('remote-startups', 'canonical'), ('remote-startups', 'supabase'),
    ('remote-startups', 'posthog'), ('remote-startups', 'sourcegraph'), ('remote-startups', 'hashicorp'),
    ('remote-startups', 'docker'), ('remote-startups', 'vercel'), ('remote-startups', 'render'),
    ('remote-startups', 'railway'), ('remote-startups', 'deel'), ('remote-startups', 'replit'),
    ('remote-startups', 'zapier'), ('remote-startups', 'sanity'),

    ('prestige-big-tech', 'google'), ('prestige-big-tech', 'meta'), ('prestige-big-tech', 'apple'),
    ('prestige-big-tech', 'amazon'), ('prestige-big-tech', 'microsoft'), ('prestige-big-tech', 'nvidia'),
    ('prestige-big-tech', 'netflix'), ('prestige-big-tech', 'linkedin'), ('prestige-big-tech', 'salesforce'),
    ('prestige-big-tech', 'adobe'), ('prestige-big-tech', 'intuit'), ('prestige-big-tech', 'oracle'),
    ('prestige-big-tech', 'servicenow'), ('prestige-big-tech', 'atlassian'),

    ('prestige-startups', 'stripe'), ('prestige-startups', 'databricks'), ('prestige-startups', 'figma'),
    ('prestige-startups', 'notion'), ('prestige-startups', 'rippling'), ('prestige-startups', 'ramp'),
    ('prestige-startups', 'brex'), ('prestige-startups', 'mercury'), ('prestige-startups', 'cursor'),
    ('prestige-startups', 'perplexity'), ('prestige-startups', 'anthropic'), ('prestige-startups', 'scale-ai'),
    ('prestige-startups', 'coreweave'), ('prestige-startups', 'hugging-face'), ('prestige-startups', 'linear'),
    ('prestige-startups', 'retool'), ('prestige-startups', 'vercel'),

    ('prestige-infra', 'nvidia'), ('prestige-infra', 'cloudflare'), ('prestige-infra', 'datadog'),
    ('prestige-infra', 'databricks'), ('prestige-infra', 'snowflake'), ('prestige-infra', 'mongodb'),
    ('prestige-infra', 'confluent'), ('prestige-infra', 'github'), ('prestige-infra', 'hashicorp'),
    ('prestige-infra', 'docker'), ('prestige-infra', 'vercel'), ('prestige-infra', 'supabase'),
    ('prestige-infra', 'neon'), ('prestige-infra', 'tailscale'), ('prestige-infra', 'coreweave'),

    ('prestige-ai', 'openai'), ('prestige-ai', 'anthropic'), ('prestige-ai', 'xai'),
    ('prestige-ai', 'deepmind'), ('prestige-ai', 'mistral'), ('prestige-ai', 'cohere'),
    ('prestige-ai', 'cursor'), ('prestige-ai', 'perplexity'), ('prestige-ai', 'safe-superintelligence'),
    ('prestige-ai', 'thinking-machines'), ('prestige-ai', 'world-labs'), ('prestige-ai', 'nvidia'),
    ('prestige-ai', 'coreweave'), ('prestige-ai', 'databricks'), ('prestige-ai', 'scale-ai'),
    ('prestige-ai', 'hugging-face'), ('prestige-ai', 'cerebras'), ('prestige-ai', 'groq'),

    ('quant-tier-1', 'jane-street'), ('quant-tier-1', 'citadel-securities'),
    ('quant-tier-1', 'citadel'), ('quant-tier-1', 'hudson-river-trading'),
    ('quant-tier-1', 'two-sigma'), ('quant-tier-1', 'de-shaw'), ('quant-tier-1', 'optiver'),
    ('quant-tier-1', 'jump-trading'), ('quant-tier-1', 'five-rings'),
    ('quant-tier-1', 'tower-research'), ('quant-tier-1', 'sig'),

    ('quant-tier-2', 'imc'), ('quant-tier-2', 'drw'), ('quant-tier-2', 'akuna-capital'),
    ('quant-tier-2', 'old-mission'), ('quant-tier-2', 'virtu'), ('quant-tier-2', 'millennium'),
    ('quant-tier-2', 'point72'), ('quant-tier-2', 'balyasny'), ('quant-tier-2', 'walleye-capital'),
    ('quant-tier-2', 'worldquant'), ('quant-tier-2', 'xtx-markets'), ('quant-tier-2', 'g-research'),
    ('quant-tier-2', 'squarepoint'), ('quant-tier-2', 'flow-traders'),

    ('freshman-friendly', 'microsoft'), ('freshman-friendly', 'google'), ('freshman-friendly', 'meta'),
    ('freshman-friendly', 'amazon'), ('freshman-friendly', 'apple'), ('freshman-friendly', 'capital-one'),
    ('freshman-friendly', 'bank-of-america'), ('freshman-friendly', 'jpmorgan-chase'),
    ('freshman-friendly', 'goldman-sachs'), ('freshman-friendly', 'salesforce'),
    ('freshman-friendly', 'intuit'), ('freshman-friendly', 'adobe'), ('freshman-friendly', 'ibm'),
    ('freshman-friendly', 'oracle'), ('freshman-friendly', 'cisco'), ('freshman-friendly', 'nvidia'),
    ('freshman-friendly', 'roblox'), ('freshman-friendly', 'datadog'), ('freshman-friendly', 'mongodb'),

    ('new-grad-friendly', 'google'), ('new-grad-friendly', 'meta'), ('new-grad-friendly', 'amazon'),
    ('new-grad-friendly', 'microsoft'), ('new-grad-friendly', 'apple'), ('new-grad-friendly', 'nvidia'),
    ('new-grad-friendly', 'salesforce'), ('new-grad-friendly', 'servicenow'), ('new-grad-friendly', 'oracle'),
    ('new-grad-friendly', 'adobe'), ('new-grad-friendly', 'intuit'), ('new-grad-friendly', 'datadog'),
    ('new-grad-friendly', 'mongodb'), ('new-grad-friendly', 'snowflake'), ('new-grad-friendly', 'stripe'),
    ('new-grad-friendly', 'ramp'), ('new-grad-friendly', 'roblox'), ('new-grad-friendly', 'uber'),
    ('new-grad-friendly', 'doordash')
)
insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select bm.sector_slug, c.slug
from bundle_members bm
join public.companies c on c.slug = bm.company_slug
where c.is_active
on conflict do nothing;
