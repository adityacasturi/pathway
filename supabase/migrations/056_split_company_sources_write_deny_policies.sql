-- Keep company source writes denied without adding a second SELECT policy.
-- The previous FOR ALL policy also applied to SELECT, which made the enabled-row
-- read policy trigger Supabase's multiple-permissive-policies advisor.

drop policy if exists "clients cannot write company sources" on public.company_sources;

create policy "clients cannot insert company sources"
  on public.company_sources for insert
  to public
  with check (false);

create policy "clients cannot update company sources"
  on public.company_sources for update
  to public
  using (false)
  with check (false);

create policy "clients cannot delete company sources"
  on public.company_sources for delete
  to public
  using (false);
