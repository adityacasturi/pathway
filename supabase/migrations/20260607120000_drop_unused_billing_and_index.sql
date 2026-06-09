-- Billing was scaffolded for a future Stripe integration but never wired in the app.
drop table if exists public.billing_subscriptions;
drop table if exists public.billing_customers;

-- Scout tool audit inserts by thread; composite user+created_at index was unused.
drop index if exists public.chat_tool_calls_user_created_at_idx;

-- Keep a lean user_id index for the FK (cascade / join paths).
create index if not exists chat_tool_calls_user_id_idx on public.chat_tool_calls (user_id);
