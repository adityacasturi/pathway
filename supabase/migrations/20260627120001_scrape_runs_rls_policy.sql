-- scrape_runs is service-role only (cron/scripts). Grants are revoked for
-- anon/authenticated; these policies document intent and satisfy the database
-- linter (RLS enabled with no policies). service_role bypasses RLS.

create policy scrape_runs_no_api_access
  on public.scrape_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);
