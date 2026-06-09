-- NVIDIA and RTX use dedicated Workday boards; scrape via the standard workday adapter.
UPDATE public.company_sources cs
SET
  source_type = 'workday',
  adapter_key = 'workday'
FROM public.companies c
WHERE cs.company_id = c.id
  AND c.slug IN ('nvidia', 'rtx')
  AND cs.source_type IN ('nvidia', 'rtx');
