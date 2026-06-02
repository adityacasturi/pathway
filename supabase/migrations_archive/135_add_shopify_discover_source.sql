-- Shopify Discover source row (source_type shopify added in 134_add_intuit_source_type.sql).

insert into public.companies (slug, name, website_url, careers_url, industry)
values (
  'shopify',
  'Shopify',
  'https://www.shopify.com',
  'https://www.shopify.com/careers',
  'b2b'
)
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  industry = coalesce(public.companies.industry, excluded.industry),
  is_active = true,
  updated_at = now();

update public.company_sources
set
  enabled = false,
  last_error_code = 'replaced_by_shopify_feed',
  updated_at = now()
where adapter_key = 'shopify-greenhouse';

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
    (select id from public.companies where slug = 'shopify'),
    'shopify',
    'shopify-careers-feed',
    'https://www.shopify.com/careers/feed.xml',
    'feed',
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
