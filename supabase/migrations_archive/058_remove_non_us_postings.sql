-- Keep only internships classified as United States locations.

delete from public.posting_source_observations o
using public.postings p
where o.posting_id = p.id
  and (
    coalesce(cardinality(p.countries), 0) = 0
    or p.countries <> array['US']::text[]
  );

delete from public.postings p
where coalesce(cardinality(p.countries), 0) = 0
   or p.countries <> array['US']::text[];
