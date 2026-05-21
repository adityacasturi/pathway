-- Keep one deny-all RLS policy per internal scraper table. The tables remain
-- unavailable to clients, while avoiding duplicate permissive policy lint.

drop policy if exists "clients cannot read company sources" on public.company_sources;
drop policy if exists "clients cannot read posting source observations" on public.posting_source_observations;
