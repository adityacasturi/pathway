alter table public.company_sources
  add column if not exists last_healthy_at timestamptz,
  add column if not exists last_healthy_fetched_count integer
    check (last_healthy_fetched_count is null or last_healthy_fetched_count >= 0),
  add column if not exists last_healthy_kept_count integer
    check (last_healthy_kept_count is null or last_healthy_kept_count >= 0),
  add column if not exists last_attempted_at timestamptz,
  add column if not exists last_attempted_fetched_count integer
    check (last_attempted_fetched_count is null or last_attempted_fetched_count >= 0),
  add column if not exists last_attempted_kept_count integer
    check (last_attempted_kept_count is null or last_attempted_kept_count >= 0),
  add column if not exists scrape_health_status text not null default 'unknown'
    check (
      scrape_health_status in (
        'unknown',
        'ok',
        'ok_no_roles',
        'suspicious_zero',
        'suspicious_drop',
        'suspicious_filter',
        'error'
      )
    ),
  add column if not exists consecutive_unhealthy_runs integer not null default 0
    check (consecutive_unhealthy_runs >= 0);

update public.company_sources
set
  last_healthy_at = coalesce(last_healthy_at, last_success_at),
  last_healthy_fetched_count = coalesce(last_healthy_fetched_count, nullif(last_fetched_count, 0)),
  last_healthy_kept_count = coalesce(last_healthy_kept_count, nullif(last_kept_count, 0)),
  last_attempted_at = coalesce(last_attempted_at, last_success_at, last_failure_at),
  last_attempted_fetched_count = coalesce(last_attempted_fetched_count, last_fetched_count),
  last_attempted_kept_count = coalesce(last_attempted_kept_count, last_kept_count),
  scrape_health_status = case
    when scrape_health_status <> 'unknown' then scrape_health_status
    when last_error_code is not null then 'error'
    when last_success_at is not null then 'ok'
    else 'unknown'
  end;

comment on column public.company_sources.last_healthy_at is
  'Timestamp of the last trusted healthy scrape; suspicious/error runs do not overwrite it.';
comment on column public.company_sources.last_healthy_fetched_count is
  'Raw fetched count from the last trusted healthy scrape; used as the source-breakage baseline.';
comment on column public.company_sources.last_healthy_kept_count is
  'Relevant kept/open count from the last trusted healthy scrape; used to detect filter regressions.';
comment on column public.company_sources.last_attempted_at is
  'Timestamp of the last scrape attempt, including suspicious/error runs.';
comment on column public.company_sources.last_attempted_fetched_count is
  'Raw fetched count from the last scrape attempt, including suspicious runs.';
comment on column public.company_sources.last_attempted_kept_count is
  'Relevant kept/open count from the last scrape attempt, including suspicious runs.';
comment on column public.company_sources.scrape_health_status is
  'Current scrape health status: ok, suspicious_* when absence is not trusted, error, or unknown.';
comment on column public.company_sources.consecutive_unhealthy_runs is
  'Consecutive suspicious/error scrape attempts since the last trusted healthy scrape.';
