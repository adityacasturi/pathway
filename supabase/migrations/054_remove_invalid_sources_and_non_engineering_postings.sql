-- Migration 054: Remove invalid sources and non-engineering internship postings.
-- Coinbase/Plaid do not currently expose valid generic ATS board endpoints.

delete from public.company_sources
where adapter_key in ('coinbase-greenhouse', 'plaid-greenhouse');

delete from public.companies c
where c.slug in ('coinbase', 'plaid')
  and not exists (
    select 1 from public.company_sources cs where cs.company_id = c.id
  )
  and not exists (
    select 1 from public.postings p where p.company_id = c.id
  );

with non_target as (
  select p.id
  from public.postings p
  where
    p.role_name ~* '\m(intern|internship|co-?op|summer)\M'
    and (
      p.role_name ~* '\m(field sales|sales|account|business|marketing|communications?|content|legal|policy|finance|accounting|people|hr|recruit(?:er|ing)?|talent|customer|support|success|operations?|strategy|program manager|project manager|product manager|product management|product design|designer|design|copywriter)\M'
      or p.role_name !~* '\m(software|swe|front[- ]?end|back[- ]?end|full[- ]?stack|developer|engineering|engineer|quant(?:itative)?|trading|research|machine learning|ml|ai|data (?:science|scientist|engineering|engineer)|infrastructure|platform|security|hardware|firmware|embedded|robotics)\M'
    )
)
delete from public.posting_source_observations o
using non_target
where o.posting_id = non_target.id;

with non_target as (
  select p.id
  from public.postings p
  where
    p.role_name ~* '\m(intern|internship|co-?op|summer)\M'
    and (
      p.role_name ~* '\m(field sales|sales|account|business|marketing|communications?|content|legal|policy|finance|accounting|people|hr|recruit(?:er|ing)?|talent|customer|support|success|operations?|strategy|program manager|project manager|product manager|product management|product design|designer|design|copywriter)\M'
      or p.role_name !~* '\m(software|swe|front[- ]?end|back[- ]?end|full[- ]?stack|developer|engineering|engineer|quant(?:itative)?|trading|research|machine learning|ml|ai|data (?:science|scientist|engineering|engineer)|infrastructure|platform|security|hardware|firmware|embedded|robotics)\M'
    )
)
delete from public.postings p
using non_target
where p.id = non_target.id;
