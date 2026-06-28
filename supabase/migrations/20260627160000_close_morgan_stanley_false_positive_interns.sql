-- Close wealth-mgmt branch intern false positives after classify-role fix (audit shard 1)

update public.scraped_postings p
set status = 'closed',
    updated_at = now()
from public.companies c
where p.company_id = c.id
  and c.slug = 'morgan-stanley'
  and p.status = 'open'
  and p.posting_url in (
    'https://morganstanley.eightfold.ai/careers/job/549798287199',
    'https://morganstanley.eightfold.ai/careers/job/549798287280',
    'https://morganstanley.eightfold.ai/careers/job/549798287140'
  );

update public.company_sources cs
set last_healthy_fetched_count = 266,
    last_healthy_kept_count = 0,
    last_healthy_at = now(),
    scrape_health_status = 'ok_no_roles',
    consecutive_unhealthy_runs = 0
from public.companies c
where cs.company_id = c.id
  and c.slug = 'morgan-stanley';
