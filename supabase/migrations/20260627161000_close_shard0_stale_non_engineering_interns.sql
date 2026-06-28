-- Close stale non-engineering intern rows after classifier improvements (audit shard 0)

update public.scraped_postings p
set status = 'closed', updated_at = now()
from public.companies c
where p.company_id = c.id
  and p.status = 'open'
  and (
    (c.slug = 'wells-fargo' and p.posting_url like '%Human-Resources-Internship%')
    or (c.slug = 'leidos' and p.posting_url in (
      'https://leidos.wd5.myworkdayjobs.com/en-US/External/job/New-York-NY/Naval-Architecture-Intern_R-00184454',
      'https://leidos.wd5.myworkdayjobs.com/en-US/External/job/Aberdeen-MD/Laboratory-Technician-Intern_R-00183639'
    ))
    or (c.slug = 'tripadvisor' and p.posting_url = 'https://job-boards.greenhouse.io/tripadvisor/jobs/8023715')
  );

update public.company_sources cs
set scrape_health_status = 'ok_no_roles',
    last_healthy_kept_count = 0,
    consecutive_unhealthy_runs = 0,
    last_healthy_at = now()
from public.companies c
where cs.company_id = c.id
  and c.slug in ('leidos', 'tripadvisor', 'wells-fargo');
