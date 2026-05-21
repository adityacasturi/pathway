-- Migration 053: Disable invalid Coinbase and Plaid Greenhouse sources.
-- Both public Greenhouse board URLs redirect to job-boards.greenhouse.io and return 404;
-- the Boards API also returns 404 for the configured board tokens.

update public.company_sources
set
  enabled = false,
  last_error_code = 'invalid_greenhouse_board_404',
  updated_at = now()
where adapter_key in ('coinbase-greenhouse', 'plaid-greenhouse');
