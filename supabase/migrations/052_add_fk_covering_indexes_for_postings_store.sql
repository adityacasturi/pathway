-- Migration 052: Add FK-covering indexes for postings store tables.
-- These remediate unindexed_foreign_keys advisor notices.

create index if not exists postings_company_id_idx
  on public.postings (company_id);

create index if not exists posting_source_observations_posting_id_idx
  on public.posting_source_observations (posting_id);

create index if not exists posting_source_observations_company_id_idx
  on public.posting_source_observations (company_id);
