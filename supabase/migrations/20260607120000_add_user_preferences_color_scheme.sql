alter table public.user_preferences
  add column if not exists color_scheme text not null default 'system';

alter table public.user_preferences
  drop constraint if exists user_preferences_color_scheme_check;

alter table public.user_preferences
  add constraint user_preferences_color_scheme_check
  check (color_scheme in ('light', 'dark', 'system'));
