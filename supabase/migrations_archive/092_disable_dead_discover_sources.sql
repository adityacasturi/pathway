-- Disable Discover scrape sources that return zero jobs from their configured public ATS API
-- (May 2026 audit: npm run scrape -- --dry-run --verbose).

update public.company_sources
set
  enabled = false,
  last_error_code = 'empty_greenhouse_board',
  updated_at = now()
where adapter_key in ('coinbase-greenhouse', 'hubspot-greenhouse');

update public.company_sources
set
  enabled = false,
  last_error_code = 'empty_ashby_board',
  updated_at = now()
where adapter_key in ('vercel-ashby', 'airtable-ashby', 'loom-ashby');

update public.company_sources
set
  enabled = false,
  last_error_code = 'empty_lever_board',
  updated_at = now()
where adapter_key = 'netflix-lever';
