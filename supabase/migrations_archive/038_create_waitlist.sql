-- Waitlist for paused public signups. Anonymous inserts are allowed (rate-limited
-- at the server-action layer); no SELECT policy so rows are only visible via the
-- Supabase dashboard / service role.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,
  created_at  timestamptz not null default now()
);

create unique index if not exists waitlist_email_lower_idx
  on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

grant insert on public.waitlist to anon, authenticated;

drop policy if exists "waitlist_insert_any" on public.waitlist;
create policy "waitlist_insert_any"
  on public.waitlist
  for insert
  to anon, authenticated
  with check (
    email is not null
    and char_length(email) between 3 and 320
    and position('@' in email) > 1
  );
