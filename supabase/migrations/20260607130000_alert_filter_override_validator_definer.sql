-- Service-role updates to alert_subscriptions.filter_override evaluate the row
-- CHECK constraint as the invoker. Without definer rights the nested app_private
-- validator calls fail with "permission denied for schema app_private".

alter function app_private.alert_filter_override_valid(jsonb)
  security definer;

alter function app_private.alert_filter_override_valid(jsonb)
  set search_path = app_private, public, pg_temp;
