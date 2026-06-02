-- Fix Discover scrape sources that 404 with guessed board tokens (083).
-- DoorDash / Anduril: correct Greenhouse board_token values.
-- Scale AI: public board is Greenhouse (scaleai), not Ashby.
-- Shopify / Rippling: no public Greenhouse/Ashby board at configured tokens — disable.

update public.company_sources
set
  source_type = 'greenhouse',
  adapter_key = 'doordash-greenhouse',
  source_url = 'https://job-boards.greenhouse.io/doordashusa',
  board_token = 'doordashusa',
  enabled = true,
  last_error_code = null,
  updated_at = now()
where adapter_key = 'doordash-greenhouse';

update public.company_sources
set
  source_type = 'greenhouse',
  adapter_key = 'anduril-greenhouse',
  source_url = 'https://job-boards.greenhouse.io/andurilindustries',
  board_token = 'andurilindustries',
  enabled = true,
  last_error_code = null,
  updated_at = now()
where adapter_key = 'anduril-greenhouse';

update public.company_sources
set
  source_type = 'greenhouse',
  adapter_key = 'scale-ai-greenhouse',
  source_url = 'https://job-boards.greenhouse.io/scaleai',
  board_token = 'scaleai',
  enabled = true,
  last_error_code = null,
  updated_at = now()
where adapter_key = 'scale-ai-ashby';

update public.company_sources
set
  enabled = false,
  last_error_code = 'invalid_greenhouse_board_404',
  updated_at = now()
where adapter_key = 'shopify-greenhouse';

update public.company_sources
set
  enabled = false,
  last_error_code = 'invalid_ashby_board_404',
  updated_at = now()
where adapter_key = 'rippling-ashby';
