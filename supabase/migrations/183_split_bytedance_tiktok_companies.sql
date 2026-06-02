-- Split TikTok (lifeattiktok.com) from ByteDance (jobs.bytedance.com) in Discover.
-- Existing scraped rows were ingested via the ByteDance API and move to the ByteDance company.

insert into public.companies (slug, name, website_url, careers_url, industry, is_active)
values (
  'bytedance',
  'ByteDance',
  'https://www.bytedance.com',
  'https://jobs.bytedance.com/en/position',
  'social',
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  industry = excluded.industry,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.company_sources (
  company_id,
  source_type,
  adapter_key,
  source_url,
  board_token,
  enabled,
  scrape_interval_minutes
)
select
  c.id,
  'bytedance',
  'bytedance-careers',
  'https://jobs.bytedance.com/en/position',
  'intern,software engineer intern,engineering intern,research intern',
  true,
  240
from public.companies c
where c.slug = 'bytedance'
  and not exists (
    select 1
    from public.company_sources cs
    where cs.company_id = c.id
      and cs.source_type = 'bytedance'
  );

update public.companies
set
  careers_url = 'https://lifeattiktok.com/early-careers',
  updated_at = now()
where slug = 'tiktok';

update public.company_sources cs
set
  source_url = 'https://lifeattiktok.com/early-careers',
  adapter_key = 'bytedance-careers-tiktok',
  board_token = 'TikTok intern,TikTok Shop intern,software engineer intern TikTok,machine learning intern TikTok,recommendation intern,trust and safety intern|7534878965941766408',
  updated_at = now()
from public.companies c
where cs.company_id = c.id
  and c.slug = 'tiktok'
  and cs.source_type = 'bytedance';

update public.scraped_postings sp
set
  company_id = bytedance.id,
  company_name = 'ByteDance',
  updated_at = now()
from public.companies tiktok, public.companies bytedance
where sp.company_id = tiktok.id
  and tiktok.slug = 'tiktok'
  and bytedance.slug = 'bytedance';
