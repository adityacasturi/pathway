-- Remove Databricks and Snowflake integration rows added by automation (incorrect/incomplete).

delete from public.posting_source_observations
where company_id in (
  select id from public.companies where slug in ('databricks', 'snowflake')
);

delete from public.postings
where company_id in (
  select id from public.companies where slug in ('databricks', 'snowflake')
);

delete from public.company_sources
where company_id in (
  select id from public.companies where slug in ('databricks', 'snowflake')
);

delete from public.companies
where slug in ('databricks', 'snowflake');
