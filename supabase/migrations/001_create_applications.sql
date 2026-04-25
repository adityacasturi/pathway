-- Migration 001: create applications table
--
-- To apply: paste into Supabase SQL Editor and run.
-- To add future changes, create 002_description.sql, etc.

create table applications (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  company     text        not null,
  role        text        not null,
  link        text,
  status      text        check (status in ('applied', 'oa', 'interview', 'rejected')) not null default 'applied',
  created_at  timestamptz default now() not null
);

-- Row Level Security
alter table applications enable row level security;

create policy "users can read own applications"
  on applications for select
  using (auth.uid() = user_id);

create policy "users can insert own applications"
  on applications for insert
  with check (auth.uid() = user_id);

create policy "users can update own applications"
  on applications for update
  using (auth.uid() = user_id);

create policy "users can delete own applications"
  on applications for delete
  using (auth.uid() = user_id);
