-- Migration 079: account-synced UI size and Discover filter preferences.

alter table public.user_preferences
  add column if not exists ui_size text,
  add column if not exists discover_show_dismissed boolean,
  add column if not exists discover_hide_applied boolean,
  add column if not exists discover_season_filter text;

alter table public.user_preferences
  drop constraint if exists user_preferences_ui_size_check;

alter table public.user_preferences
  add constraint user_preferences_ui_size_check
  check (ui_size is null or ui_size in ('small', 'medium', 'large'));

alter table public.user_preferences
  drop constraint if exists user_preferences_discover_season_filter_check;

alter table public.user_preferences
  add constraint user_preferences_discover_season_filter_check
  check (discover_season_filter is null or discover_season_filter in ('all', 'Summer', 'Fall'));
