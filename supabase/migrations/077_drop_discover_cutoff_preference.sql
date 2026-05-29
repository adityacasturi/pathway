-- Discover cutoff is fixed in app code (March 31 default); per-user override removed.

alter table public.user_preferences
  drop column if exists discover_cutoff_date;
