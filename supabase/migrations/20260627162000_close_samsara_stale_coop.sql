-- Close stale non-engineering co-op after classifier filter (audit shard 3)

update public.scraped_postings p
set status = 'closed', updated_at = now()
from public.companies c
where p.company_id = c.id
  and c.slug = 'samsara'
  and p.status = 'open';

update public.company_sources cs
set scrape_health_status = 'ok_no_roles',
    last_healthy_kept_count = 0,
    consecutive_unhealthy_runs = 0,
    last_healthy_at = now()
from public.companies c
where cs.company_id = c.id
  and c.slug = 'samsara';
