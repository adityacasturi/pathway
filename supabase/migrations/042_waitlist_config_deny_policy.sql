-- Make the private waitlist HMAC secret table's RLS posture explicit for
-- advisors and future readers. The waitlist RPC runs as its owner; browser
-- roles should never read or write this table.

drop policy if exists "waitlist_config_deny_browser_roles" on app_private.waitlist_config;
create policy "waitlist_config_deny_browser_roles"
  on app_private.waitlist_config
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
