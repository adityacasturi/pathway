-- Drop retired Scout/chat tables, digest state, and unused geo cache.

-- Chat assistant removed from product; tables are empty.
drop trigger if exists chat_messages_touch_thread_updated_at on public.chat_messages;
drop function if exists public.touch_chat_thread_updated_at();

drop table if exists public.chat_tool_calls;
drop table if exists public.chat_messages;
drop table if exists public.chat_threads;

-- Digest alerts retired; instant-only subscriptions remain.
drop policy if exists "Users read own digest state" on public.alert_digest_state;
drop table if exists public.alert_digest_state;

alter table public.alert_preferences
  drop column if exists digest_enabled;

-- Never wired to application code; empty since creation.
drop table if exists app_private.location_resolution_cache;
