-- Tier-1 Greenhouse additions (verified public boards) + fix Plaid/Coinbase Discover sources.
--
-- Verified via boards-api.greenhouse.io and api.ashbyhq.com (May 2026):
--   janestreet (Greenhouse), riotgames (Greenhouse), plaid (Ashby), coinbase (Greenhouse embed; jobs may be sparse).
--
-- Not added (no public Greenhouse/Ashby/Lever board): Uber, Snap, Atlassian, Zoom, Intuit, Adobe, Intel.
-- Shopify uses embedded Ashby without a public job-board API slug; Rippling uses a custom careers site.

insert into public.companies (slug, name, website_url, careers_url, priority)
values
  ('plaid', 'Plaid', 'https://plaid.com', 'https://plaid.com/careers', 11),
  ('riot-games', 'Riot Games', 'https://www.riotgames.com', 'https://www.riotgames.com/en/work-with-us', 111),
  ('jane-street', 'Jane Street', 'https://www.janestreet.com', 'https://www.janestreet.com/join-jane-street/open-roles', 112)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  priority = excluded.priority,
  is_active = true,
  updated_at = now();

delete from public.company_sources
where adapter_key = 'plaid-greenhouse';

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
    (select id from public.companies where slug = 'plaid'),
    'ashby',
    'plaid-ashby',
    'https://jobs.ashbyhq.com/plaid',
    'plaid',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'riot-games'),
    'greenhouse',
    'riot-games-greenhouse',
    'https://job-boards.greenhouse.io/riotgames',
    'riotgames',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'jane-street'),
    'greenhouse',
    'jane-street-greenhouse',
    'https://job-boards.greenhouse.io/janestreet',
    'janestreet',
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
  source_type = excluded.source_type,
  source_url = excluded.source_url,
  board_token = excluded.board_token,
  enabled = true,
  last_error_code = null,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();

update public.company_sources
set
  source_url = 'https://job-boards.greenhouse.io/coinbase',
  board_token = 'coinbase',
  enabled = true,
  last_error_code = null,
  updated_at = now()
where adapter_key = 'coinbase-greenhouse';

update public.company_sources
set
  last_error_code = 'private_ashby_job_board',
  updated_at = now()
where adapter_key = 'shopify-greenhouse'
   or adapter_key = 'rippling-ashby';
