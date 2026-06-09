-- Harden Scout chat persistence and add per-tool audit logging.

alter table public.chat_messages
  add column if not exists client_message_id text;

create unique index if not exists chat_messages_thread_client_message_id_idx
  on public.chat_messages (thread_id, client_message_id)
  where client_message_id is not null;

create table if not exists public.chat_tool_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  tool_call_id text,
  tool_name text not null,
  args jsonb not null default '{}'::jsonb,
  result_summary jsonb,
  latency_ms integer not null check (latency_ms >= 0),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists chat_tool_calls_user_created_at_idx
  on public.chat_tool_calls (user_id, created_at desc);

create index if not exists chat_tool_calls_thread_created_at_idx
  on public.chat_tool_calls (thread_id, created_at asc);

alter table public.chat_tool_calls enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_tool_calls'
      and policyname = 'Users read own chat tool calls'
  ) then
    create policy "Users read own chat tool calls"
      on public.chat_tool_calls for select
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_tool_calls'
      and policyname = 'Users insert own chat tool calls'
  ) then
    create policy "Users insert own chat tool calls"
      on public.chat_tool_calls for insert
      with check ((select auth.uid()) = user_id);
  end if;
end;
$$;
