-- Move public waitlist writes behind a narrow RPC. The browser/app no longer
-- needs a service-role key or waitlist hash pepper: Postgres owns the write,
-- the rate-limit counters, and the HMAC secret.

create table if not exists app_private.waitlist_config (
  id          boolean primary key default true,
  secret      bytea not null default extensions.gen_random_bytes(32),
  created_at  timestamptz not null default now(),
  constraint waitlist_config_singleton check (id)
);

alter table app_private.waitlist_config enable row level security;

revoke all on table app_private.waitlist_config from public, anon, authenticated;
grant select on table app_private.waitlist_config to service_role;

insert into app_private.waitlist_config (id)
values (true)
on conflict (id) do nothing;

create or replace function app_private.join_waitlist(
  p_email text,
  p_ip_key text,
  p_source text default 'landing'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_ip_key text;
  v_source text;
  v_secret bytea;
  v_email_hash text;
  v_ip_hash text;
  v_since timestamptz := now() - interval '24 hours';
  v_email_attempts integer;
  v_ip_attempts integer;
  v_inserted integer;
begin
  v_email := lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_ip_key := coalesce(nullif(pg_catalog.btrim(p_ip_key), ''), 'unknown');
  v_source := pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_source), ''), 'landing'), 80);

  if v_email is null
    or pg_catalog.char_length(v_email) not between 7 and 320
    or pg_catalog.length(v_email) - pg_catalog.length(pg_catalog.replace(v_email, '@', '')) <> 1
    or pg_catalog.split_part(v_email, '@', 2) <> 'uw.edu'
    or pg_catalog.strpos(v_email, '@') <= 1
  then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error', 'Use your @uw.edu email for now.'
    );
  end if;

  select secret
    into v_secret
    from app_private.waitlist_config
   where id = true;

  if v_secret is null then
    insert into app_private.waitlist_config (id)
    values (true)
    on conflict (id) do update
      set id = excluded.id
    returning secret into v_secret;
  end if;

  v_email_hash := pg_catalog.encode(
    extensions.hmac(pg_catalog.convert_to(v_email, 'UTF8'), v_secret, 'sha256'),
    'hex'
  );
  v_ip_hash := pg_catalog.encode(
    extensions.hmac(pg_catalog.convert_to(v_ip_key, 'UTF8'), v_secret, 'sha256'),
    'hex'
  );

  select pg_catalog.count(*)::integer
    into v_email_attempts
    from public.waitlist_attempts
   where email_hash = v_email_hash
     and created_at >= v_since;

  select pg_catalog.count(*)::integer
    into v_ip_attempts
    from public.waitlist_attempts
   where ip_hash = v_ip_hash
     and created_at >= v_since;

  if v_email_attempts >= 3 or v_ip_attempts >= 12 then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error', 'Too many attempts. Please wait a bit and try again.'
    );
  end if;

  insert into public.waitlist_attempts (email_hash, ip_hash)
  values (v_email_hash, v_ip_hash);

  insert into public.waitlist (email, source)
  values (v_email, v_source)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'alreadyJoined', v_inserted = 0
  );
end;
$$;

revoke all on function app_private.join_waitlist(text, text, text) from public, anon, authenticated;

-- app_private remains outside the exposed API schemas. USAGE + EXECUTE here
-- only lets these roles reach the specific private function through the public
-- wrapper below; table privileges remain revoked and RLS stays enabled.
grant usage on schema app_private to anon, authenticated;
grant execute on function app_private.join_waitlist(text, text, text) to anon, authenticated;

create or replace function public.join_waitlist(
  p_email text,
  p_ip_key text,
  p_source text default 'landing'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app_private.join_waitlist(p_email, p_ip_key, p_source);
$$;

revoke all on function public.join_waitlist(text, text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
