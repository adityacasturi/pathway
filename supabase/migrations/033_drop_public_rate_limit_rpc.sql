-- Migration 033: remove the public authenticated rate-limit RPC.
--
-- Feed refresh throttling now happens inside the server action. Database write
-- throttles still use app_private.enforce_rate_limit through private triggers.

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
drop function if exists public.consume_rate_limit(text, integer, integer);
