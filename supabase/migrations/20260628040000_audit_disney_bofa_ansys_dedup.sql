-- Allow the same posting URL under different companies (Ansys/Synopsys shared board).
alter table public.scraped_postings
  drop constraint if exists scraped_postings_posting_url_unique;

drop index if exists public.scraped_postings_posting_url_unique;

create unique index if not exists scraped_postings_company_posting_url_unique
  on public.scraped_postings (company_id, posting_url);

alter table public.company_sources
  drop constraint if exists company_sources_source_type_check;

alter table public.company_sources
  add constraint company_sources_source_type_check
  check (source_type = any (array[
    'greenhouse', 'ashby', 'lever', 'workday', 'nvidia', 'microsoft', 'google',
    'jane_street', 'hudson_river_trading', 'apple', 'citadel', 'two_sigma', 'amazon',
    'meta', 'qualcomm', 'uber', 'salesforce', 'de_shaw', 'tesla', 'amd', 'bytedance',
    'atlassian', 'tower_research', 'sig', 'rivian', 'five_rings', 'jpmorgan_chase',
    'bloomberg', 'goldman_sachs', 'oracle', 'morgan_stanley', 'linkedin', 'intuit',
    'shopify', 'netflix', 'ibm', 'coinbase', 'citigroup', 'rtx', 'millennium',
    'lockheed_martin', 'workable', 'hiringthing', 'surge', 'smartrecruiters', 'github',
    'splunk', 'slack', 'jobvite', 'juniper_networks', 'vmware', 'sap', 'teradata',
    'seagate', 'l3harris', 'arm', 'valve', 'bae_systems', 'chewy', 'electronic_arts',
    'etsy', 'peak6', 'wayfair', 'general_dynamics', 'sakana_ai', 'replicate', 'luma_ai',
    'modular', 'breezy', 'weights_biases', 'one_x_technologies', 'synopsys', 'disney',
    'bank_of_america', 'x_corp', 'pinpoint', 'rippling', 'clearcompany', 'icims', 'asml'
  ]::text[]));

-- Disney: switch from Greenhouse stub to TalentBrew on www.disneycareers.com.
update public.company_sources cs
set
  source_type = 'disney',
  adapter_key = 'disney-talentbrew',
  source_url = 'https://www.disneycareers.com/en/search-jobs?k=intern',
  board_token = 'intern',
  scrape_health_status = 'ok',
  last_fetched_count = null,
  last_kept_count = null,
  last_healthy_fetched_count = null,
  last_healthy_kept_count = null
from public.companies c
where c.id = cs.company_id
  and c.slug = 'disney';

-- Bank of America: campus programs on Oleeo/TAL, not lateral Workday board.
update public.company_sources cs
set
  source_type = 'bank_of_america',
  adapter_key = 'bank-of-america-campus',
  source_url = 'https://bankcampuscareers.tal.net/candidate',
  board_token = null,
  scrape_health_status = 'ok',
  last_fetched_count = null,
  last_kept_count = null,
  last_healthy_fetched_count = null,
  last_healthy_kept_count = null
from public.companies c
where c.id = cs.company_id
  and c.slug = 'bank-of-america';
