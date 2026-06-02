-- Persist inferred ISO country codes for scraped postings (US-only product scope).

alter table public.scraped_postings
  add column if not exists countries text[] not null default '{}';

comment on column public.scraped_postings.countries is
  'ISO 3166-1 alpha-2 codes inferred from location after US trim; empty when location is null.';

create index if not exists scraped_postings_open_us_countries_idx
  on public.scraped_postings using gin (countries)
  where status = 'open';

-- Legacy international-only open rows (no US in location text heuristics).
update public.scraped_postings
set status = 'closed',
    updated_at = now(),
    last_seen_at = now()
where status = 'open'
  and location is not null
  and btrim(location) <> ''
  and location !~* '(^|[,·|/;\s])(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)([,·|/;\s]|$)'
  and location !~* '\b(united states|united states of america|u\.?s\.?a?\.?|america)\b'
  and location !~* '\bremote\s*(in\s+)?(the\s+)?(u\.?s\.?a?\.?|united states)\b'
  and (
    location ~* '\b(canada|united kingdom|uk|england|scotland|wales|ireland|germany|france|spain|italy|netherlands|belgium|switzerland|austria|sweden|norway|denmark|finland|poland|india|china|hong kong|taiwan|japan|south korea|singapore|malaysia|indonesia|philippines|thailand|vietnam|australia|new zealand|israel|uae|brazil|mexico|shanghai|beijing|shenzhen|bangalore|bengaluru|hyderabad|mumbai|pune|delhi|gurgaon|toronto|vancouver|montreal|ottawa|london|paris|berlin|munich|amsterdam|zurich|dublin|tel aviv|dubai|seoul|tokyo|sydney|melbourne)\b'
    or location ~* ',\s*(CA|ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)\s*([,·|/;]|$)'
  );

-- Rows with no location cannot be US-scoped; close until rescraped with location.
update public.scraped_postings
set status = 'closed',
    updated_at = now(),
    last_seen_at = now()
where status = 'open'
  and (location is null or btrim(location) = '');

-- Best-effort US backfill for remaining open rows (full accuracy from scrape upsert).
update public.scraped_postings
set countries = array['US']::text[]
where status = 'open'
  and countries = '{}'::text[]
  and location is not null
  and btrim(location) <> '';
