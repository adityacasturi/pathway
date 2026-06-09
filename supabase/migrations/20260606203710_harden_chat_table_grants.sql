-- Narrow chat table grants. RLS scopes row access, but table-level TRUNCATE is
-- not protected by RLS and should never be available to client roles.

revoke all on table public.chat_threads from anon;
revoke all on table public.chat_messages from anon;
revoke all on table public.chat_tool_calls from anon;

revoke all on table public.chat_threads from authenticated;
revoke all on table public.chat_messages from authenticated;
revoke all on table public.chat_tool_calls from authenticated;

grant select, insert, update, delete on table public.chat_threads to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;
grant select, insert on table public.chat_tool_calls to authenticated;
