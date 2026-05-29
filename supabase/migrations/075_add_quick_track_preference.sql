-- Allow users to add feed postings to applications without the confirmation dialog.

alter table public.user_preferences
  add column if not exists quick_track_enabled boolean not null default false;
