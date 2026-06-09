-- Drop legacy public alert write RPCs now that alert writes run through
-- scoped server actions using the service-role client.

drop function if exists public.add_alert_sector_subscription(text, jsonb);
drop function if exists public.add_alert_company_subscription(uuid, jsonb);
drop function if exists public.set_alert_global_filters(text[], text[], boolean);
drop function if exists public.update_alert_subscription_filters(uuid, jsonb);
