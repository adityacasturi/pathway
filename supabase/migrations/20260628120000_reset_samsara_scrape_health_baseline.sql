-- Samsara has no engineering intern/co-op roles; stale last_kept_count=1 kept
-- re-triggering suspicious_filter after the co-op close migration.

update public.company_sources cs
set scrape_health_status = 'ok_no_roles',
    last_kept_count = 0,
    last_healthy_kept_count = 0,
    consecutive_unhealthy_runs = 0,
    last_error_code = null,
    last_healthy_at = now()
from public.companies c
where cs.company_id = c.id
  and c.slug = 'samsara';
