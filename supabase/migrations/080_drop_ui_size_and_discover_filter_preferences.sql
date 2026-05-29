-- Migration 080: roll back account-synced UI size and Discover filter preferences.

alter table public.user_preferences
  drop constraint if exists user_preferences_ui_size_check,
  drop constraint if exists user_preferences_discover_season_filter_check;

alter table public.user_preferences
  drop column if exists ui_size,
  drop column if exists discover_show_dismissed,
  drop column if exists discover_hide_applied,
  drop column if exists discover_season_filter;
