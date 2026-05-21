-- Let signed-in users view public source-board health on the Boards page.
-- Writes remain unavailable to browser roles because no write grants are added
-- and the existing deny-write RLS policy is preserved.

grant select on public.company_sources to authenticated;

create policy "authenticated users can read enabled company sources"
  on public.company_sources for select
  to authenticated
  using (enabled = true);
