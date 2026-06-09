alter function app_private.alert_countries_valid(p_countries text[])
  set search_path = app_private, public, pg_temp;

alter function app_private.alert_filter_override_valid(p_override jsonb)
  set search_path = app_private, public, pg_temp;

alter function app_private.alert_seasons_valid(p_seasons text[])
  set search_path = app_private, public, pg_temp;
