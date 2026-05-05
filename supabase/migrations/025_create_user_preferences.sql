-- Migration 025: per-user preferences for app surfaces.
--
-- Discover uses discover_cutoff_date to hide postings older than the user's
-- chosen cutoff. The application code clamps this to a maximum two-month
-- history window.

create table user_preferences (
  user_id              uuid primary key references auth.users(id) on delete cascade not null,
  discover_cutoff_date date,
  updated_at           timestamptz default now() not null
);

alter table user_preferences enable row level security;

create policy "users can read own preferences"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "users can insert own preferences"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "users can update own preferences"
  on user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
