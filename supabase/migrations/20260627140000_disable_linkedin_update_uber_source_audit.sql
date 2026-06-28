-- Scrape audit 2026-06-27: LinkedIn guest search unstable; Uber careers canonical URL moved to jobs.uber.com

update public.company_sources cs
set enabled = false,
    scrape_health_status = 'ok_no_roles'
from public.companies c
where cs.company_id = c.id
  and c.slug = 'linkedin';

update public.company_sources cs
set source_url = 'https://jobs.uber.com/en/jobs/?programAndLevel=Internship&team=Engineering'
from public.companies c
where cs.company_id = c.id
  and c.slug = 'uber'
  and cs.source_url like '%uber.com/careers/list%';
