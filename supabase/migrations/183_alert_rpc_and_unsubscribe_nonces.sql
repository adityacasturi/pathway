-- RPC-only alert writes, unsubscribe nonce ledger, companies.industry index.

create table if not exists public.alert_unsubscribe_nonces (
  nonce text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  used_at timestamptz not null default now()
);

create index if not exists alert_unsubscribe_nonces_user_id_idx
  on public.alert_unsubscribe_nonces (user_id);

alter table public.alert_unsubscribe_nonces enable row level security;

create index if not exists companies_industry_idx on public.companies (industry);

revoke insert, update, delete on public.alert_subscriptions from authenticated;
revoke insert, update, delete on public.alert_preferences from authenticated;

create or replace function public.set_alert_emails_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.alert_preferences (user_id, emails_enabled, updated_at)
  values (auth.uid(), p_enabled, now())
  on conflict (user_id) do update
  set emails_enabled = excluded.emails_enabled,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.set_alert_digest_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.alert_preferences (user_id, digest_enabled, updated_at)
  values (auth.uid(), p_enabled, now())
  on conflict (user_id) do update
  set digest_enabled = excluded.digest_enabled,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.add_alert_sector_subscription(p_sector_slug text)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.alert_subscriptions (user_id, target_type, target_id, cadence)
  values (auth.uid(), 'sector', trim(p_sector_slug), 'instant')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.add_alert_company_subscription(p_company_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into public.alert_subscriptions (user_id, target_type, target_id, cadence)
  values (auth.uid(), 'company', p_company_id::text, 'instant')
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.delete_alert_subscription(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  delete from public.alert_subscriptions
  where id = p_subscription_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.set_alert_emails_enabled(boolean) to authenticated;
grant execute on function public.set_alert_digest_enabled(boolean) to authenticated;
grant execute on function public.add_alert_sector_subscription(text) to authenticated;
grant execute on function public.add_alert_company_subscription(uuid) to authenticated;
grant execute on function public.delete_alert_subscription(uuid) to authenticated;
