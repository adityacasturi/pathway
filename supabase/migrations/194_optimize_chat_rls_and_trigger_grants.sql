-- Optimize chat RLS policies and prevent direct RPC execution of the chat touch trigger.

drop policy if exists "Users manage own chat threads" on public.chat_threads;
create policy "Users manage own chat threads"
  on public.chat_threads for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage messages in own threads" on public.chat_messages;
create policy "Users manage messages in own threads"
  on public.chat_messages for all
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  );

revoke all on function public.touch_chat_thread_updated_at() from public, anon, authenticated;
