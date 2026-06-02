-- Discover batch: Blue Origin, quant shops, AI/security/aerospace names (May 2026).
-- Workable: Hugging Face. HiringThing: Voloridge. Surge: surgehq.ai careers HTML.
-- Greenhouse/Lever/Workday boards verified via public APIs where enabled.

alter table public.company_sources
  drop constraint if exists company_sources_source_type_check;

alter table public.company_sources
  add constraint company_sources_source_type_check
  check (
    source_type in (
      'ashby',
      'greenhouse',
      'lever',
      'workday',
      'nvidia',
      'microsoft',
      'google',
      'jane_street',
      'hudson_river_trading',
      'apple',
      'citadel',
      'two_sigma',
      'amazon',
      'meta',
      'qualcomm',
      'uber',
      'salesforce',
      'de_shaw',
      'tesla',
      'amd',
      'bytedance',
      'atlassian',
      'tower_research',
      'sig',
      'rivian',
      'five_rings',
      'jpmorgan_chase',
      'bloomberg',
      'goldman_sachs',
      'shopify',
      'oracle',
      'morgan_stanley',
      'linkedin',
      'intuit',
      'netflix',
      'ibm',
      'coinbase',
      'citigroup',
      'rtx',
      'millennium',
      'cruise',
      'lockheed_martin',
      'workable',
      'hiringthing',
      'surge'
    )
  );

insert into public.companies (slug, name, website_url, careers_url, industry)
values
  (
    'blue-origin',
    'Blue Origin',
    'https://www.blueorigin.com',
    'https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin',
    'aerospace'
  ),
  (
    'radix-trading',
    'Radix Trading',
    'https://www.radixtrading.com',
    'https://job-boards.greenhouse.io/radixuniversity',
    'quant'
  ),
  (
    'voloridge',
    'Voloridge',
    'https://www.voloridge.com',
    'https://voloridge-investment-management.hiringthing.com/',
    'quant'
  ),
  (
    'chicago-trading-company',
    'Chicago Trading Company',
    'https://www.ctglab.com',
    'https://job-boards.greenhouse.io/chicagotrading',
    'quant'
  ),
  (
    'verkada',
    'Verkada',
    'https://www.verkada.com',
    'https://job-boards.greenhouse.io/verkada',
    'security'
  ),
  (
    'varda-space',
    'Varda Space',
    'https://www.varda.com',
    'https://job-boards.greenhouse.io/vardaspace',
    'aerospace'
  ),
  (
    'shield-ai',
    'Shield AI',
    'https://shield.ai',
    'https://jobs.lever.co/shieldai',
    'autonomy'
  ),
  (
    'figure-ai',
    'Figure AI',
    'https://www.figure.ai',
    'https://job-boards.greenhouse.io/figureai',
    'ai'
  ),
  (
    'groq',
    'Groq',
    'https://groq.com',
    'https://groq.com/careers-at-groq',
    'ai'
  ),
  (
    'hugging-face',
    'Hugging Face',
    'https://huggingface.co',
    'https://apply.workable.com/huggingface',
    'ai'
  ),
  (
    'wiz',
    'Wiz',
    'https://www.wiz.io',
    'https://job-boards.greenhouse.io/wizinc',
    'security'
  ),
  (
    'labelbox',
    'Labelbox',
    'https://labelbox.com',
    'https://job-boards.greenhouse.io/labelbox',
    'ai'
  ),
  (
    'snorkel-ai',
    'Snorkel AI',
    'https://snorkel.ai',
    'https://job-boards.greenhouse.io/snorkelai',
    'ai'
  ),
  (
    'surge-ai',
    'Surge AI',
    'https://www.surgehq.ai',
    'https://www.surgehq.ai/careers',
    'ai'
  ),
  (
    'balyasny',
    'Balyasny Asset Management',
    'https://www.bamfunds.com',
    'https://www.bamfunds.com/careers',
    'quant'
  ),
  (
    'xtx-markets',
    'XTX Markets',
    'https://www.xtxmarkets.com',
    'https://job-boards.greenhouse.io/xtxmarketstechnologies',
    'quant'
  ),
  (
    'headlands-technology',
    'Headlands Technology',
    'https://www.headlandstech.com',
    'https://www.headlandstech.com/careers/',
    'quant'
  ),
  (
    'hashicorp',
    'HashiCorp',
    'https://www.hashicorp.com',
    'https://www.hashicorp.com/careers',
    'devtools'
  ),
  (
    'hermeus',
    'Hermeus',
    'https://www.hermeus.com',
    'https://jobs.lever.co/hermeus',
    'aerospace'
  ),
  (
    'planet-labs',
    'Planet Labs',
    'https://www.planet.com',
    'https://job-boards.greenhouse.io/planetlabs',
    'aerospace'
  ),
  (
    'sentinelone',
    'SentinelOne',
    'https://www.sentinelone.com',
    'https://www.sentinelone.com/careers/',
    'security'
  ),
  (
    'cerebras',
    'Cerebras',
    'https://www.cerebras.ai',
    'https://job-boards.greenhouse.io/cerebrassystems',
    'ai'
  ),
  (
    'retool',
    'Retool',
    'https://retool.com',
    'https://retool.com/careers',
    'devtools'
  ),
  (
    'dbt-labs',
    'dbt Labs',
    'https://www.getdbt.com',
    'https://job-boards.greenhouse.io/dbtlabsinc',
    'data'
  ),
  (
    'joby-aviation',
    'Joby Aviation',
    'https://www.jobyaviation.com',
    'https://careers-jobyaviation.icims.com/jobs/intro',
    'aerospace'
  ),
  (
    'zoom',
    'Zoom',
    'https://zoom.us',
    'https://careers.zoom.us/',
    'big-tech'
  )
on conflict (slug) do update set
  name = excluded.name,
  website_url = excluded.website_url,
  careers_url = excluded.careers_url,
  industry = coalesce(public.companies.industry, excluded.industry),
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
  (
    (select id from public.companies where slug = 'blue-origin'),
    'workday',
    'blue-origin-workday',
    'https://blueorigin.wd5.myworkdayjobs.com/en-US/BlueOrigin',
    'BlueOrigin',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'radix-trading'),
    'greenhouse',
    'radix-trading-greenhouse',
    'https://job-boards.greenhouse.io/radixuniversity',
    'radixuniversity',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'voloridge'),
    'hiringthing',
    'voloridge-hiringthing',
    'https://voloridge-investment-management.hiringthing.com/',
    'voloridge-investment-management',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'chicago-trading-company'),
    'greenhouse',
    'chicago-trading-company-greenhouse',
    'https://job-boards.greenhouse.io/chicagotrading',
    'chicagotrading',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'verkada'),
    'greenhouse',
    'verkada-greenhouse',
    'https://job-boards.greenhouse.io/verkada',
    'verkada',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'varda-space'),
    'greenhouse',
    'varda-space-greenhouse',
    'https://job-boards.greenhouse.io/vardaspace',
    'vardaspace',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'shield-ai'),
    'lever',
    'shield-ai-lever',
    'https://jobs.lever.co/shieldai',
    'shieldai',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'figure-ai'),
    'greenhouse',
    'figure-ai-greenhouse',
    'https://job-boards.greenhouse.io/figureai',
    'figureai',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'hugging-face'),
    'workable',
    'hugging-face-workable',
    'https://apply.workable.com/huggingface',
    'huggingface',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'wiz'),
    'greenhouse',
    'wiz-greenhouse',
    'https://job-boards.greenhouse.io/wizinc',
    'wizinc',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'labelbox'),
    'greenhouse',
    'labelbox-greenhouse',
    'https://job-boards.greenhouse.io/labelbox',
    'labelbox',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'snorkel-ai'),
    'greenhouse',
    'snorkel-ai-greenhouse',
    'https://job-boards.greenhouse.io/snorkelai',
    'snorkelai',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'surge-ai'),
    'surge',
    'surge-ai-careers',
    'https://www.surgehq.ai/careers',
    'careers',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'xtx-markets'),
    'greenhouse',
    'xtx-markets-greenhouse',
    'https://job-boards.greenhouse.io/xtxmarketstechnologies',
    'xtxmarketstechnologies',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'hermeus'),
    'lever',
    'hermeus-lever',
    'https://jobs.lever.co/hermeus',
    'hermeus',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'planet-labs'),
    'greenhouse',
    'planet-labs-greenhouse',
    'https://job-boards.greenhouse.io/planetlabs',
    'planetlabs',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'cerebras'),
    'greenhouse',
    'cerebras-greenhouse',
    'https://job-boards.greenhouse.io/cerebrassystems',
    'cerebrassystems',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'dbt-labs'),
    'greenhouse',
    'dbt-labs-greenhouse',
    'https://job-boards.greenhouse.io/dbtlabsinc',
    'dbtlabsinc',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'zoom'),
    'workday',
    'zoom-workday',
    'https://zoom.wd5.myworkdayjobs.com/en-US/Zoom',
    'Zoom',
    true,
    240
  ),
  (
    (select id from public.companies where slug = 'groq'),
    'greenhouse',
    'groq-greenhouse',
    'https://job-boards.greenhouse.io/groq',
    'groq',
    false,
    240
  ),
  (
    (select id from public.companies where slug = 'balyasny'),
    'greenhouse',
    'balyasny-greenhouse',
    'https://job-boards.greenhouse.io/balyasny',
    'balyasny',
    false,
    240
  ),
  (
    (select id from public.companies where slug = 'headlands-technology'),
    'greenhouse',
    'headlands-technology-greenhouse',
    'https://job-boards.greenhouse.io/headlandstechnology',
    'headlandstechnology',
    false,
    240
  ),
  (
    (select id from public.companies where slug = 'hashicorp'),
    'greenhouse',
    'hashicorp-greenhouse',
    'https://job-boards.greenhouse.io/hashicorp',
    'hashicorp',
    false,
    240
  ),
  (
    (select id from public.companies where slug = 'sentinelone'),
    'greenhouse',
    'sentinelone-greenhouse',
    'https://job-boards.greenhouse.io/sentinelone',
    'sentinelone',
    false,
    240
  ),
  (
    (select id from public.companies where slug = 'retool'),
    'greenhouse',
    'retool-greenhouse',
    'https://job-boards.greenhouse.io/retool',
    'retool',
    false,
    240
  ),
  (
    (select id from public.companies where slug = 'joby-aviation'),
    'greenhouse',
    'joby-aviation-greenhouse',
    'https://job-boards.greenhouse.io/joby',
    'joby',
    false,
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
  enabled = excluded.enabled,
  last_error_code = case when excluded.enabled then null else coalesce(public.company_sources.last_error_code, 'no_public_job_feed') end,
  scrape_interval_minutes = excluded.scrape_interval_minutes,
  updated_at = now();

update public.company_sources
set
  last_error_code = 'no_public_job_feed',
  updated_at = now()
where adapter_key in (
  'groq-greenhouse',
  'balyasny-greenhouse',
  'headlands-technology-greenhouse',
  'hashicorp-greenhouse',
  'sentinelone-greenhouse',
  'retool-greenhouse',
  'joby-aviation-greenhouse'
)
  and enabled = false;
