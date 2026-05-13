-- Migration 034: add a vetted per-user accent color preference.

alter table user_preferences
  add column if not exists accent_color text;

alter table user_preferences
  drop constraint if exists user_preferences_accent_color_check;

alter table user_preferences
  add constraint user_preferences_accent_color_check
  check (accent_color is null or accent_color in ('midnight', 'sage', 'sky', 'rose'));
