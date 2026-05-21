-- Make the internal posting-source tables explicit about having no direct
-- client access, and cover the company FK used by scraper reconciliation.

create policy "clients cannot read company sources"
  on public.company_sources for select
  to public
  using (false);

create policy "clients cannot write company sources"
  on public.company_sources for all
  to public
  using (false)
  with check (false);

create policy "clients cannot read posting source observations"
  on public.posting_source_observations for select
  to public
  using (false);

create policy "clients cannot write posting source observations"
  on public.posting_source_observations for all
  to public
  using (false)
  with check (false);

create index posting_source_observations_company_idx
  on public.posting_source_observations (company_id);
