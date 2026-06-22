-- Roll back scraped posting description and compensation columns.
drop index if exists public.scraped_postings_compensation_idx;

alter table public.scraped_postings
  drop constraint if exists scraped_postings_description_hash_check,
  drop constraint if exists scraped_postings_compensation_amount_check,
  drop constraint if exists scraped_postings_compensation_currency_check,
  drop constraint if exists scraped_postings_compensation_period_check,
  drop constraint if exists scraped_postings_compensation_confidence_check;

alter table public.scraped_postings
  drop column if exists description_text,
  drop column if exists description_hash,
  drop column if exists description_updated_at,
  drop column if exists description_html,
  drop column if exists compensation_min,
  drop column if exists compensation_max,
  drop column if exists compensation_currency,
  drop column if exists compensation_period,
  drop column if exists compensation_raw,
  drop column if exists compensation_confidence;
