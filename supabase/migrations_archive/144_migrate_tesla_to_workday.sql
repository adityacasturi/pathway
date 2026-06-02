-- Tesla public internships are on Workday (tesla.wd1.myworkdayjobs.com), not the tesla.com CUA API.
-- The CUA careers/state endpoint is behind Akamai and returns 403/429 for datacenter scrapers.

update public.companies
set
  careers_url = 'https://tesla.wd1.myworkdayjobs.com/en-US/External',
  updated_at = now()
where slug = 'tesla';

update public.company_sources
set
  source_type = 'workday',
  adapter_key = 'tesla-workday',
  source_url = 'https://tesla.wd1.myworkdayjobs.com/en-US/External',
  board_token = 'External',
  enabled = true,
  last_error_code = null,
  updated_at = now()
where adapter_key = 'tesla-careers'
  and company_id = (select id from public.companies where slug = 'tesla');
