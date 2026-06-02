-- Tesla internships are listed on tesla.com (CUA careers API), not the public Workday tenant.
-- tesla.wd1.myworkdayjobs.com currently redirects to Workday maintenance (CXS returns 422).

update public.companies
set
  careers_url = 'https://www.tesla.com/careers/search',
  updated_at = now()
where slug = 'tesla';

update public.company_sources
set
  source_type = 'tesla',
  adapter_key = 'tesla-careers',
  source_url = 'https://www.tesla.com/careers/search/?query=intern&site=US',
  board_token = 'US',
  enabled = true,
  last_error_code = null,
  updated_at = now()
where adapter_key = 'tesla-workday'
  and company_id = (select id from public.companies where slug = 'tesla');
