-- Add crypto as a single-label Discover industry (split from fintech).

alter table public.companies
  drop constraint if exists companies_industry_check;

alter table public.companies
  add constraint companies_industry_check
  check (
    industry in (
      'ai',
      'fintech',
      'crypto',
      'devtools',
      'consumer',
      'enterprise',
      'mobility',
      'security',
      'quant'
    )
  );

update public.companies
set industry = 'crypto', updated_at = now()
where slug in (
  'coinbase',
  'gemini',
  'binance',
  'phantom',
  'anchorage',
  'blockchain',
  'fireblocks',
  'ripple'
);
