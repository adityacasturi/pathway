-- Make the waitlist lockdown explicit for Supabase advisors and future readers.
-- service_role bypasses RLS; browser roles have no grants and these deny
-- policies document that they should never access the waitlist tables directly.

drop policy if exists "waitlist_deny_browser_roles" on public.waitlist;
create policy "waitlist_deny_browser_roles"
  on public.waitlist
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "waitlist_attempts_deny_browser_roles" on public.waitlist_attempts;
create policy "waitlist_attempts_deny_browser_roles"
  on public.waitlist_attempts
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
