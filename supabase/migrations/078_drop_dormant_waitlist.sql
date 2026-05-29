-- Drop the dormant waitlist surface now that public signup is enabled and the
-- waitlist UI/action code has been removed.

drop function if exists public.join_waitlist(text, text, text);
drop function if exists app_private.join_waitlist(text, text, text);

drop table if exists public.waitlist_attempts;
drop table if exists public.waitlist;
drop table if exists app_private.waitlist_config;
