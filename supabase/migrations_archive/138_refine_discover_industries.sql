-- Add semiconductor, automotive, finance, and media industries; fix misclassified companies.

alter table public.companies
  drop constraint if exists companies_industry_check;

-- Semiconductors (chip companies, not hyperscale platforms)
update public.companies set industry = 'semiconductor', updated_at = now()
where slug in ('qualcomm', 'amd', 'intel', 'micron');

-- Finance (banks, brokerages, markets data — not fintech startups)
update public.companies set industry = 'finance', updated_at = now()
where slug in (
  'bloomberg',
  'goldman-sachs',
  'jpmorgan-chase',
  'morgan-stanley',
  'capital-one'
);

-- Media
update public.companies set industry = 'media', updated_at = now()
where slug in ('netflix', 'spotify');

-- Automotive (vehicle OEMs and auto retail)
update public.companies set industry = 'automotive', updated_at = now()
where slug in ('rivian', 'tesla', 'lucid-motors', 'carvana');

-- B2B enterprise (not big-tech platforms)
update public.companies set industry = 'b2b', updated_at = now()
where slug in ('oracle', 'salesforce', 'ibm', 'linkedin', 'toast');

-- Productivity
update public.companies set industry = 'productivity', updated_at = now()
where slug in ('atlassian', 'intuit');

-- Quant firms added via custom scrapers
update public.companies set industry = 'quant', updated_at = now()
where slug in ('de-shaw', 'five-rings', 'sig', 'tower-research');

-- TikTok / ByteDance consumer social
update public.companies set industry = 'consumer', updated_at = now()
where slug = 'tiktok';

-- Lucid moved out of autonomy in app map; ensure autonomy cohort excludes OEMs
update public.companies set industry = 'autonomy', updated_at = now()
where slug in (
  'waymo', 'nuro', 'aurora', 'applied-intuition', 'zoox', 'wayve', 'bird', 'chargepoint'
);

alter table public.companies
  add constraint companies_industry_check
  check (
    industry in (
      'big-tech',
      'semiconductor',
      'ai',
      'fintech',
      'finance',
      'crypto',
      'cloud',
      'data',
      'devtools',
      'security',
      'gaming',
      'media',
      'consumer',
      'productivity',
      'b2b',
      'automotive',
      'autonomy',
      'aerospace',
      'quant'
    )
  );
