-- Seven additional Discover companies (Greenhouse only) to reach ~200 enabled adapter-backed companies.

insert into public.companies (slug, name, website_url, careers_url, industry)
values
  ('attentive', 'Attentive', 'https://www.attentive.com', 'https://www.attentive.com/careers', 'enterprise'),
  ('braze', 'Braze', 'https://www.braze.com', 'https://www.braze.com/careers', 'devtools'),
  ('klaviyo', 'Klaviyo', 'https://www.klaviyo.com', 'https://www.klaviyo.com/careers', 'enterprise'),
  ('nebius', 'Nebius', 'https://nebius.com', 'https://nebius.com/careers', 'ai'),
  ('tanium', 'Tanium', 'https://www.tanium.com', 'https://www.tanium.com/careers', 'security'),
  ('wayve', 'Wayve', 'https://wayve.ai', 'https://wayve.ai/careers', 'mobility'),
  ('workato', 'Workato', 'https://www.workato.com', 'https://www.workato.com/careers', 'enterprise')
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  industry = excluded.industry,
  is_active = true,
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
values
  ((select id from public.companies where slug = 'attentive'), 'greenhouse', 'attentive-greenhouse', 'https://job-boards.greenhouse.io/attentive', 'attentive', true, 240),
  ((select id from public.companies where slug = 'braze'), 'greenhouse', 'braze-greenhouse', 'https://job-boards.greenhouse.io/braze', 'braze', true, 240),
  ((select id from public.companies where slug = 'klaviyo'), 'greenhouse', 'klaviyo-greenhouse', 'https://job-boards.greenhouse.io/klaviyo', 'klaviyo', true, 240),
  ((select id from public.companies where slug = 'nebius'), 'greenhouse', 'nebius-greenhouse', 'https://job-boards.greenhouse.io/nebius', 'nebius', true, 240),
  ((select id from public.companies where slug = 'tanium'), 'greenhouse', 'tanium-greenhouse', 'https://job-boards.greenhouse.io/tanium', 'tanium', true, 240),
  ((select id from public.companies where slug = 'wayve'), 'greenhouse', 'wayve-greenhouse', 'https://job-boards.greenhouse.io/wayve', 'wayve', true, 240),
  ((select id from public.companies where slug = 'workato'), 'greenhouse', 'workato-greenhouse', 'https://job-boards.greenhouse.io/workato', 'workato', true, 240)
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
