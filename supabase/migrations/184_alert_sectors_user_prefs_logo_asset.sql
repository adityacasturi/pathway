-- Curated alert sector metadata + membership, cross-device view prefs, logo asset keys.

-- 1) Alert sectors: metadata on existing slug table + company membership
alter table public.alert_curated_sectors
  add column if not exists label text,
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0;

update public.alert_curated_sectors as s
set
  label = v.label,
  description = v.description,
  sort_order = v.sort_order
from (
  values
    ('faang', 'FAANG+', 'Meta, Apple, Amazon, Netflix, Google, Microsoft', 10),
    ('ai-stack', 'AI labs', 'OpenAI, Anthropic, Scale, and frontier model shops', 20),
    ('quant', 'Quant', 'Jane Street, Citadel, HRT, Two Sigma, and peers', 30),
    ('semis', 'Semis', 'NVIDIA, AMD, Qualcomm, Intel, and chip leaders', 40),
    ('wall-street', 'Wall Street', 'Goldman, JPMorgan, Morgan Stanley, Citi, Bloomberg', 50),
    ('autonomous', 'Autonomous & robotics', 'Waymo, Zoox, Aurora, Figure, Tesla, and self-driving stacks', 60),
    ('defense', 'Defense & space', 'Lockheed, Anduril, Palantir, SpaceX, Northrop', 70),
    ('unicorns', 'Unicorns', 'Stripe, Databricks, Figma, Notion, Discord, Canva, Rippling', 80),
    (
      'cybersecurity',
      'Cybersecurity',
      'CrowdStrike, Palo Alto Networks, Okta, Wiz, SentinelOne, and security leaders',
      90
    )
) as v(slug, label, description, sort_order)
where s.slug = v.slug;

alter table public.alert_curated_sectors
  alter column label set not null,
  alter column description set not null;

create table if not exists public.alert_curated_sector_companies (
  sector_slug text not null references public.alert_curated_sectors (slug) on delete cascade,
  company_slug text not null references public.companies (slug) on delete cascade,
  primary key (sector_slug, company_slug)
);

create index if not exists alert_curated_sector_companies_company_slug_idx
  on public.alert_curated_sector_companies (company_slug);

alter table public.alert_curated_sector_companies enable row level security;

create policy "Anyone can read curated sector companies"
  on public.alert_curated_sector_companies for select
  using (true);

-- Seed membership (only companies that exist in catalog)
insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'faang', c.slug
from public.companies c
where c.slug in ('meta', 'apple', 'amazon', 'netflix', 'google', 'microsoft')
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'ai-stack', c.slug
from public.companies c
where c.slug in ('openai', 'anthropic', 'xai', 'cohere', 'mistral', 'scale-ai', 'perplexity')
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'quant', c.slug
from public.companies c
where c.slug in (
  'jane-street',
  'citadel',
  'hudson-river-trading',
  'two-sigma',
  'de-shaw',
  'optiver',
  'sig',
  'five-rings'
)
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'semis', c.slug
from public.companies c
where c.slug in ('nvidia', 'amd', 'qualcomm', 'intel', 'broadcom', 'micron')
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'wall-street', c.slug
from public.companies c
where c.slug in ('goldman-sachs', 'jpmorgan-chase', 'morgan-stanley', 'citigroup', 'bloomberg')
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'autonomous', c.slug
from public.companies c
where c.slug in ('waymo', 'zoox', 'nuro', 'aurora', 'figure-ai', 'applied-intuition', 'tesla')
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'defense', c.slug
from public.companies c
where c.slug in ('lockheed-martin', 'anduril', 'palantir', 'spacex', 'northrop-grumman', 'rtx')
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'unicorns', c.slug
from public.companies c
where c.slug in ('stripe', 'databricks', 'figma', 'notion', 'discord', 'canva', 'rippling')
on conflict do nothing;

insert into public.alert_curated_sector_companies (sector_slug, company_slug)
select 'cybersecurity', c.slug
from public.companies c
where c.slug in ('crowdstrike', 'palo-alto-networks', 'okta', 'wiz', 'sentinelone', 'zscaler')
on conflict do nothing;

-- 2) Cross-device UI preferences
alter table public.user_preferences
  add column if not exists live_last_seen_at timestamptz,
  add column if not exists live_show_dismissed boolean not null default false,
  add column if not exists live_hide_applied boolean not null default true,
  add column if not exists live_season_filter text not null default 'all',
  add column if not exists hide_rejected boolean not null default true,
  add column if not exists hide_archived boolean not null default true;

alter table public.user_preferences
  drop constraint if exists user_preferences_live_season_filter_check;

alter table public.user_preferences
  add constraint user_preferences_live_season_filter_check
  check (live_season_filter in ('all', 'Summer', 'Fall', 'Spring', 'Winter'));

-- 3) Static logo asset key (served from /company-logos/{slug}.png — not blob storage)
alter table public.companies
  add column if not exists logo_asset_key text;

comment on column public.companies.logo_asset_key is
  'When set, equals companies.slug and a PNG exists at public/company-logos/{slug}.png';

update public.companies
set logo_asset_key = slug
where logo_asset_key is null
  and is_active = true;
