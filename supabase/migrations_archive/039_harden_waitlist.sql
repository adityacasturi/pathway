-- Harden waitlist writes for the waitlist-first launch:
-- - only UW email addresses are accepted
-- - browser clients can no longer insert directly into public.waitlist
-- - durable anti-abuse counters store only keyed hashes, not raw emails/IPs

create table if not exists public.waitlist_attempts (
  id          uuid primary key default gen_random_uuid(),
  email_hash  text not null,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists waitlist_attempts_email_hash_created_at_idx
  on public.waitlist_attempts (email_hash, created_at desc);

create index if not exists waitlist_attempts_ip_hash_created_at_idx
  on public.waitlist_attempts (ip_hash, created_at desc);

alter table public.waitlist_attempts enable row level security;

revoke all on table public.waitlist_attempts from anon, authenticated;
grant select, insert, delete on table public.waitlist_attempts to service_role;

alter table public.waitlist
  drop constraint if exists waitlist_email_uw_domain_check;

alter table public.waitlist
  add constraint waitlist_email_uw_domain_check
  check (
    email = lower(btrim(email))
    and length(email) - length(replace(email, '@', '')) = 1
    and split_part(email, '@', 2) = 'uw.edu'
    and position('@' in email) > 1
    and char_length(email) between 7 and 320
  ) not valid;

revoke all on table public.waitlist from anon, authenticated;
grant select, insert on table public.waitlist to service_role;

drop policy if exists "waitlist_insert_any" on public.waitlist;
