-- The previous "midnight" accent was deep indigo blue; true black is now "midnight".
alter table public.user_preferences
  drop constraint if exists user_preferences_accent_color_check;

alter table public.user_preferences
  add constraint user_preferences_accent_color_check
  check (
    accent_color is null
    or accent_color = any (array['midnight', 'indigo', 'sage', 'sky', 'rose']::text[])
  );

alter table public.user_preferences disable trigger user_preferences_rate_limit;

update public.user_preferences
set accent_color = 'indigo',
    updated_at = now()
where accent_color = 'midnight';

alter table public.user_preferences enable trigger user_preferences_rate_limit;
