-- Keep the public waitlist wrapper as the only browser-callable RPC. The
-- private implementation still runs as its owner through public.join_waitlist.

revoke all on function app_private.join_waitlist(text, text, text) from public, anon, authenticated;
