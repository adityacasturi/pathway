-- Migration 035: narrow accent choices to the final vetted palette.

alter table public.user_preferences
  disable trigger user_preferences_rate_limit;

alter table public.user_preferences
  drop constraint if exists user_preferences_accent_color_check;

update public.user_preferences
set accent_color = case
  when accent_color in ('slate', 'midnight') then 'midnight'
  when accent_color in ('powder-blue', 'powder', 'sky') then 'sky'
  when accent_color in ('rosewood', 'dusty-plum', 'clay', 'rose') then 'rose'
  when accent_color = 'sage' then 'sage'
  else 'midnight'
end
where accent_color is not null
  and accent_color not in ('midnight', 'sage', 'sky', 'rose');

alter table public.user_preferences
  enable trigger user_preferences_rate_limit;

alter table public.user_preferences
  add constraint user_preferences_accent_color_check
  check (accent_color is null or accent_color in ('midnight', 'sage', 'sky', 'rose'));
