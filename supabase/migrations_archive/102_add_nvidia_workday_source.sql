-- NVIDIA Discover source: public Workday CXS at nvidia.wd5 (verified May 2026).
-- Legacy jobs.nvidia.com / Eightfold row is disabled (PCSX API requires auth).

alter table public.company_sources
  drop constraint if exists company_sources_source_type_check;

alter table public.company_sources
  add constraint company_sources_source_type_check
  check (source_type in ('ashby', 'greenhouse', 'lever', 'workday', 'nvidia'));

update public.company_sources
set
  enabled = false,
  last_error_code = 'replaced_by_nvidia_workday_adapter',
  updated_at = now()
where adapter_key = 'nvidia-eightfold';

insert into public.company_sources (
  company_id,
  source_type,
  adapter_key,
  source_url,
  board_token,
  enabled,
  scrape_interval_minutes
)
values
  (
    (select id from public.companies where slug = 'nvidia'),
    'nvidia',
    'nvidia-workday',
    'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite',
    'NVIDIAExternalCareerSite',
    true,
    240
  )
on conflict (
  company_id,
  source_type,
  adapter_key,
  coalesce(board_token, ''),
  coalesce(source_url, '')
) do update set
  source_url = excluded.source_url,
  board_token = excluded.board_token,
  enabled = true,
  last_error_code = null,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();
