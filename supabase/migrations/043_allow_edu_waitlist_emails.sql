-- Broaden dormant waitlist eligibility from UW-only to any .edu address so
-- the preserved waitlist path matches the public signup policy if reopened.

alter table public.waitlist
  drop constraint if exists waitlist_email_uw_domain_check;

alter table public.waitlist
  add constraint waitlist_email_edu_domain_check
  check (
    email = lower(btrim(email))
    and length(email) - length(replace(email, '@', '')) = 1
    and split_part(email, '@', 2) like '%.edu'
    and position('@' in email) > 1
    and char_length(email) between 7 and 320
  ) not valid;

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
    or pg_catalog.split_part(v_email, '@', 2) not like '%.edu'
    or pg_catalog.strpos(v_email, '@') <= 1
  then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'error', 'Use your school .edu email.'
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
grant execute on function app_private.join_waitlist(text, text, text) to anon, authenticated;
