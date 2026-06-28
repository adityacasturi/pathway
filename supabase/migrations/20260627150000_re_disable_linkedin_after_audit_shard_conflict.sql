-- Re-disable after zero-shard-3 re-enabled during audit; guest search still authwall-unstable per docs/scraping.md

update public.company_sources cs
set enabled = false,
    scrape_health_status = 'ok_no_roles'
from public.companies c
where cs.company_id = c.id
  and c.slug = 'linkedin';
