-- Migration 016: add persisted application archive state.
--
-- To apply: paste into Supabase SQL Editor and run.

alter table applications
  add column if not exists archived_at timestamptz;

create index if not exists applications_user_archived_at_idx
  on applications (user_id, archived_at);
