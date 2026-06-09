-- Count all open scraped roles for eligible companies (not US-only).
-- Country scoping belongs in user-facing filters, not aggregate catalog counts.

create or replace function public.discover_company_open_counts()
returns table(company_id uuid, open_count bigint)
language sql
stable
set search_path to 'public'
as $function$
  select sp.company_id, count(*)::bigint as open_count
  from public.scraped_postings sp
  join public.companies c on c.id = sp.company_id
  where sp.status = 'open'
    and c.is_active
    and exists (
      select 1
      from public.company_sources cs
      where cs.company_id = c.id
        and cs.enabled
    )
  group by sp.company_id;
$function$;

create or replace function public.market_posting_summary(_now timestamp with time zone default now())
returns table(
  open_total bigint,
  since_yesterday bigint,
  remote_open bigint,
  dominant_season text,
  week_posted_count bigint,
  week_remote_count bigint,
  week_active_company_count bigint,
  week_top_season text,
  week_top_location_label text,
  week_top_location_count bigint,
  discover_companies bigint,
  companies_with_open_roles bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with eligible as (
    select
      sp.company_id,
      sp.season,
      sp.location,
      sp.first_seen_at,
      coalesce(sp.date_posted, sp.first_seen_at) as activity_at
    from public.scraped_postings sp
    join public.companies c on c.id = sp.company_id
    where sp.status = 'open'
      and c.is_active
      and exists (
        select 1
        from public.company_sources cs
        where cs.company_id = c.id
          and cs.enabled
      )
  ),
  day_posts as (
    select * from eligible where first_seen_at >= _now - interval '1 day'
  ),
  week_posts as (
    select * from eligible where activity_at >= _now - interval '7 days'
  ),
  dominant_day_season as (
    select season
    from day_posts
    group by season
    order by count(*) desc, season asc
    limit 1
  ),
  top_week_season as (
    select season
    from week_posts
    group by season
    order by count(*) desc, season asc
    limit 1
  ),
  week_locations as (
    select nullif(btrim(split_part(split_part(location, ' · ', 1), ',', 1)), '') as label
    from week_posts
    where location is not null and btrim(location) <> ''
  ),
  top_week_location as (
    select label, count(*)::bigint as count
    from week_locations
    where label is not null
    group by label
    order by count(*) desc, label asc
    limit 1
  )
  select
    (select count(*) from eligible)::bigint as open_total,
    (select count(*) from day_posts)::bigint as since_yesterday,
    (select count(*) from eligible where location ilike '%remote%')::bigint as remote_open,
    (select season from dominant_day_season) as dominant_season,
    (select count(*) from week_posts)::bigint as week_posted_count,
    (select count(*) from week_posts where location ilike '%remote%')::bigint as week_remote_count,
    (select count(distinct company_id) from week_posts)::bigint as week_active_company_count,
    (select season from top_week_season) as week_top_season,
    (select label from top_week_location) as week_top_location_label,
    (select count from top_week_location) as week_top_location_count,
    (select count(*) from public.companies where is_active)::bigint as discover_companies,
    (select count(distinct company_id) from eligible)::bigint as companies_with_open_roles;
$function$;
