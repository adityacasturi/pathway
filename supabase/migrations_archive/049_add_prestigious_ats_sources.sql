-- Migration 049: Add prestigious ATS sources for Stripe, Figma, Airbnb, Palantir, Notion, Ramp, Vercel

-- 1. Insert companies
insert into public.companies (slug, name, website_url, careers_url, priority)
values
  ('stripe', 'Stripe', 'https://stripe.com', 'https://stripe.com/jobs', 11),
  ('figma', 'Figma', 'https://www.figma.com', 'https://www.figma.com/careers', 12),
  ('airbnb', 'Airbnb', 'https://www.airbnb.com', 'https://careers.airbnb.com', 13),
  ('palantir', 'Palantir', 'https://www.palantir.com', 'https://www.palantir.com/careers', 14),
  ('notion', 'Notion', 'https://www.notion.so', 'https://www.notion.so/careers', 15),
  ('ramp', 'Ramp', 'https://ramp.com', 'https://ramp.com/careers', 16),
  ('vercel', 'Vercel', 'https://vercel.com', 'https://vercel.com/careers', 17)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
  is_active = true,
  updated_at = now();

-- 2. Insert company sources
insert into public.company_sources (company_id, source_type, adapter_key, source_url, board_token, enabled, scrape_interval_minutes)
values
  (
    (select id from public.companies where slug = 'stripe'),
    'greenhouse',
    'stripe-greenhouse',
    'https://boards.greenhouse.io/stripe',
    'stripe',
    true,
    180
  ),
  (
    (select id from public.companies where slug = 'figma'),
    'greenhouse',
    'figma-greenhouse',
    'https://boards.greenhouse.io/figma',
    'figma',
    true,
    180
  ),
  (
    (select id from public.companies where slug = 'airbnb'),
    'greenhouse',
    'airbnb-greenhouse',
    'https://boards.greenhouse.io/airbnb',
    'airbnb',
    true,
    180
  ),
  (
    (select id from public.companies where slug = 'palantir'),
    'lever',
    'palantir-lever',
    'https://jobs.lever.co/palantir',
    'palantir',
    true,
    180
  ),
  (
    (select id from public.companies where slug = 'notion'),
    'ashby',
    'notion-ashby',
    'https://jobs.ashbyhq.com/notion',
    'notion',
    true,
    180
  ),
  (
    (select id from public.companies where slug = 'ramp'),
    'ashby',
    'ramp-ashby',
    'https://jobs.ashbyhq.com/ramp',
    'ramp',
    true,
    180
  ),
  (
    (select id from public.companies where slug = 'vercel'),
    'ashby',
    'vercel-ashby',
    'https://jobs.ashbyhq.com/vercel',
    'vercel',
    true,
    180
  )
on conflict (company_id, source_type, adapter_key, coalesce(board_token, ''), coalesce(source_url, '')) do update set
  enabled = true,
  scrape_interval_minutes = 180,
  updated_at = now();
