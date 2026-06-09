-- AI chat threads and messages (user-scoped, RLS enforced).

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_threads_user_id_updated_at_idx
  on public.chat_threads (user_id, updated_at desc);

alter table public.chat_threads enable row level security;

create policy "Users manage own chat threads"
  on public.chat_threads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_thread_id_created_at_idx
  on public.chat_messages (thread_id, created_at asc);

alter table public.chat_messages enable row level security;

create policy "Users manage messages in own threads"
  on public.chat_messages for all
  using (
    exists (
      select 1
      from public.chat_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.chat_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  );

create or replace function public.touch_chat_thread_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

create trigger chat_messages_touch_thread_updated_at
  after insert on public.chat_messages
  for each row
  execute function public.touch_chat_thread_updated_at();
