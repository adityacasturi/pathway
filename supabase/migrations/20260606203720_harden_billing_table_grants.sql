-- Billing tables are managed by trusted server/webhook code only. Client roles
-- must not have TRUNCATE or direct write privileges.

revoke all on table public.billing_customers from anon;
revoke all on table public.billing_subscriptions from anon;

revoke all on table public.billing_customers from authenticated;
revoke all on table public.billing_subscriptions from authenticated;

grant select on table public.billing_customers to authenticated;
grant select on table public.billing_subscriptions to authenticated;
