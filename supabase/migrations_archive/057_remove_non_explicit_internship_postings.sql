-- Remove active scraped postings whose titles do not explicitly identify them
-- as internships/co-ops. Scraper code now applies the same title-level rule
-- before ingestion, so these rows are historical false positives.

delete from public.posting_source_observations o
using public.postings p
where o.posting_id = p.id
  and p.status in ('open', 'stale', 'unknown')
  and p.role_name !~* '\m(intern|internship|co-?op)\M';

delete from public.postings p
where p.status in ('open', 'stale', 'unknown')
  and p.role_name !~* '\m(intern|internship|co-?op)\M';
