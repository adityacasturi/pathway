-- Migration 036: rename the blue accent from powder to sky.

alter table public.user_preferences
  disable trigger user_preferences_rate_limit;

alter table public.user_preferences
  drop constraint if exists user_preferences_accent_color_check;

update public.user_preferences
set accent_color = 'sky'
where accent_color in ('powder', 'powder-blue');

alter table public.user_preferences
  enable trigger user_preferences_rate_limit;

alter table public.user_preferences
  add constraint user_preferences_accent_color_check
  check (accent_color is null or accent_color in ('midnight', 'sage', 'sky', 'rose'));
